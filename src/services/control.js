'use strict';

const fs = require('fs');
const path = require('path');
const async = require('async');
const npm = require('npm');
const tmp = require('tmp');
const childProcess = require('child_process');
const mkdirp = require('mkdirp');

const config = require('../config');
const logger = require('../server/logging').logger;
const PathService = require('./path');
const ContentRoutingService = require('./content/routing');
const TemplateRoutingService = require('./template/routing');
const RewriteService = require('./rewrite');
const NunjucksService = require('./nunjucks');
const createAtomicLoader = require('./nunjucks/atomic-loader');

let controlSHA = null;
let lastAttemptSHA = null;
let updateInProgress = false;
let cachePath = null;

const ControlService = {
  load: function (sha, callback) {
    const startTs = Date.now();
    logger.info('Loading control repository', { service: 'control', sha });

    NunjucksService.initialize((err) => {
      if (err) {
        logger.error('Unable to bootstrap nunjucks templates.', {
          service: 'control',
          sha,
          errMessage: err.message,
          stack: err.stack,
          duration: Date.now() - startTs
        });

        return callback(false);
      }

      async.parallel({
        contentMap: readContentMap,
        templateMap: readTemplateMap,
        rewriteMap: readRewriteMap,
        plugins: loadPlugins,
        loaders: loadTemplates
      }, (err, result) => {
        if (err) {
          logger.error('Unable to load control repository', {
            service: 'control',
            sha,
            errMessage: err.message,
            stack: err.stack,
            duration: Date.now() - startTs
          });

          return callback(false);
        }

        ContentRoutingService.setContentMap(result.contentMap);
        TemplateRoutingService.setTemplateMap(result.templateMap);
        RewriteService.setRewriteMap(result.rewriteMap);

        const domains = [];
        for (let domain in result.contentMap) {
          const plugins = result.plugins[domain] || [];
          const loaders = [];
          if (result.loaders[domain]) {
            loaders.push(result.loaders[domain]);
          }

          NunjucksService.installEnvironment(domain, loaders, plugins);

          domains.push(domain);
        }

        logger.info('Successfully loaded control repository', {
          service: 'control',
          sha,
          domains,
          duration: Date.now() - startTs
        });

        callback(true);
      });
    });
  },
  update: function (sha, callback) {
    // The callback is optional.
    if (!callback) {
      callback = () => {};
    }

    if (updateInProgress) {
      return callback(false);
    }

    const startTs = Date.now();
    if (sha !== null && lastAttemptSHA === sha) {
      logger.info('Skipping load of already-attempted SHA', { service: 'control', sha });
      return callback(false);
    }
    lastAttemptSHA = sha;

    const isGit = !!config.control_repo_url();
    const shouldUpdate = (sha === null) || (sha !== controlSHA);

    if (!shouldUpdate) {
      logger.info('Control repository is already up to date.', { service: 'control', sha });

      return callback(false);
    }

    logger.info('Updating control repository', { service: 'control', sha });
    updateInProgress = true;

    const handleErr = (err) => {
      logger.error('Unable to update control repository', {
        service: 'control',
        sha,
        errMessage: err.message,
        stack: err.stack
      });

      updateInProgress = false;
      callback(false);
    };

    let gitStartTs = null;
    let gitCompletePayload = null;

    const andLoad = (err, newSHA) => {
      if (err) return handleErr(err);

      if (gitStartTs !== null && gitCompletePayload !== null) {
        gitCompletePayload.duration = Date.now() - gitStartTs;
        const msg = gitCompletePayload.message;
        delete gitCompletePayload.message;

        logger.info(msg, gitCompletePayload);
      }

      this.load(newSHA, (ok) => {
        if (ok) {
          logger.info('Control repository update complete.', {
            service: 'control',
            fromSHA: controlSHA,
            sha: newSHA,
            duration: Date.now() - startTs
          });

          controlSHA = newSHA;
        } else {
          logger.error('Control repository load failed.', {
            service: 'control',
            currentSHA: controlSHA,
            sha: newSHA
          });
        }

        updateInProgress = false;
        callback(ok);
      });
    };

    if (isGit) {
      const parentPath = path.dirname(PathService.getControlRepoPath());

      mkdirp(parentPath, (err) => {
        if (err) return handleErr(err);

        fs.readdir(PathService.getControlRepoPath(), (err, contents) => {
          if (err) {
            if (err.code === 'ENOENT') {
              // New repository.

              logger.debug('Beginning control repository clone', {
                service: 'control',
                sha,
                url: config.control_repo_url(),
                branch: config.control_repo_branch()
              });
              gitCompletePayload = {
                service: 'control',
                sha,
                message: 'Completed control repository clone',
                url: config.control_repo_url(),
                branch: config.control_repo_branch()
              };
              gitStartTs = Date.now();

              gitClone(
                config.control_repo_url(),
                config.control_repo_branch(),
                PathService.getControlRepoPath(),
                andLoad);
              return;
            }

            return handleErr(err);
          }

          // Existing repository.
          logger.debug('Beginning control repository pull', { service: 'control', sha });
          gitCompletePayload = {message: 'Completed control repository pull'};
          gitStartTs = Date.now();

          gitPull(
            PathService.getControlRepoPath(),
            andLoad);
        });
      });
    } else {
      // Non-git repository. Most likely a local mount.
      logger.debug('Skipping update for non-git control repository.', { service: 'control', sha });

      return andLoad(null, 'non-git');
    }
  },
  getControlSHA: function () {
    return controlSHA;
  }
};

module.exports = ControlService;

const readAndMergeConfigFiles = function (files, def, callback) {
  // for compatibility. Might be called with files as a single path, not an
  // array of paths
  if (!Array.isArray(files)) {
    files = [files];
  }

  async.reduce(files, {}, function (previousValue, currentValue, reduceCallback) {
    fs.readFile(currentValue, {encoding: 'utf-8'}, (err, body) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return callback(null, def);
        }

        return callback(err);
      }

      let doc;
      try {
        doc = JSON.parse(body);
      } catch (e) {
        doc = {};
        logger.warn('Configuration file contained invalid JSON', {
          service: 'control',
          errMessage: e.message,
          filename: currentValue,
          source: body
        });
      }

      // I'm surprised this little concatenation loop works as well as it does.
      // Could definitely use some testing to be sure it covers all the
      // _reasonable_ use cases.
      for (let site in doc) {
        if (doc.hasOwnProperty(site)) {
          if (previousValue.hasOwnProperty(site)) {
            previousValue[site] = previousValue[site].concat(doc[site]);
          } else {
            previousValue[site] = doc[site];
          }
        }
      }

      reduceCallback(null, previousValue);
    });
  }, callback);
};

const subdirectories = function (rootPath, callback) {
  fs.readdir(rootPath, (err, entries) => {
    if (err) return callback(err);

    async.filter(entries, (entry, cb) => {
      fs.stat(path.join(rootPath, entry), (err, fstat) => {
        if (err) return callback(err, null);
        cb(null, fstat.isDirectory());
      });
    }, callback);
  });
};

const git = function (args, cwd, callback) {
  const options = {};
  if (cwd) options.cwd = cwd;
  const stdoutChunks = [];
  const stderrChunks = [];

  const stdout = () => Buffer.concat(stdoutChunks).toString('utf-8');
  const stderr = () => Buffer.concat(stderrChunks).toString('utf-8');

  const p = childProcess.spawn('/usr/bin/git', args, options);

  p.stdout.on('data', (chunk) => stdoutChunks.push(chunk));

  p.stderr.on('data', (chunk) => stderrChunks.push(chunk));

  p.on('close', (status) => {
    if (status !== 0) {
      const e = new Error(`git command ${args} exited with non-zero status ${status}`);
      e.gitArgs = args;
      e.status = status;
      e.stdout = stdout();
      e.stderr = stderr();
      return callback(e);
    }

    callback(null, {
      stdout: stdout(),
      stderr: stderr()
    });
  });

  p.on('error', (err) => {
    err.gitArgs = args;
    err.stdout = stdout();
    err.stderr = stderr();

    return callback(err);
  });
};

const readCurrentSHA = function (repoPath, callback) {
  git(['rev-parse', 'HEAD'], repoPath, (err, output) => {
    if (err) return callback(err);

    callback(null, output.stdout.replace(/\r?\n$/, ''));
  });
};

const gitClone = function (url, branch, repoPath, callback) {
  git(['clone', '--branch', branch, url, repoPath], null, (err) => {
    if (err) return callback(err);

    readCurrentSHA(repoPath, callback);
  });
};

const gitPull = function (repoPath, callback) {
  // Destroy any local modifications and forcibly set the workspace and index to the most
  // recently fetched branch tip.

  const fetch = (cb) => git(['fetch', '--force'], repoPath, cb);

  const clean = (cb) => git(['clean', '--force', '-d'], repoPath, cb);

  const reset = (cb) => git(['reset', '--hard', 'FETCH_HEAD'], repoPath, cb);

  async.series([fetch, clean, reset], (err) => {
    if (err) return callback(err);

    readCurrentSHA(repoPath, callback);
  });
};

// Read functions

const readContentMap = function (callback) {
  const contentFiles = PathService.getContentFiles();

  logger.debug('Beginning content map load', {
    service: 'control',
    files: contentFiles
  });

  readAndMergeConfigFiles(contentFiles, {}, (err, contentMap) => {
    if (err) return callback(err);

    logger.debug('Successfully loaded content map', {
      service: 'control',
      files: contentFiles
    });
    callback(null, contentMap);
  });
};

const readTemplateMap = function (callback) {
  var routeFiles = PathService.getRoutesFiles();

  logger.debug('Begining template map load', {
    service: 'control',
    files: routeFiles
  });

  readAndMergeConfigFiles(routeFiles, {}, (err, templateMap) => {
    if (err) return callback(err);

    logger.debug('Successfully loaded template map', {
      service: 'control',
      filename: routeFiles
    });
    callback(null, templateMap);
  });
};

const readRewriteMap = function (callback) {
  const rewriteFiles = PathService.getRewritesFiles();

  logger.debug('Beginning rewrite map load', {
    service: 'control',
    files: rewriteFiles
  });

  readAndMergeConfigFiles(rewriteFiles, {}, (err, rewriteMap) => {
    if (err) return callback(err);

    logger.debug('Successfully loaded rewrite map', {
      service: 'control',
      files: rewriteFiles
    });

    callback(null, rewriteMap);
  });
};

const loadPlugins = function (callback) {
  const pluginsRoot = PathService.getPluginsRoot();
  const beginTs = Date.now();
  logger.debug('Beginning plugin load', {
    service: 'control',
    path: pluginsRoot
  });

  subdirectories(pluginsRoot, (err, subdirs) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // No plugins to enumerate.
        return callback(null, {});
      }

      return callback(err);
    }

    async.map(subdirs, loadDomainPlugins, (err, results) => {
      if (err) return callback(err);

      logger.debug('Successfully loaded plugins', {
        service: 'control',
        path: pluginsRoot,
        pluginCount: results.length,
        duration: Date.now() - beginTs
      });

      const output = {};
      for (let i = 0; i < results.length; i++) {
        output[subdirs[i]] = results[i];
      }

      callback(null, output);
    });
  });
};

const loadDomainPlugins = function (domain, callback) {
  const domainRoot = path.join(PathService.getPluginsRoot(), domain);

  subdirectories(domainRoot, (err, subdirs) => {
    if (err) return callback(err);

    async.map(subdirs, (subdir, cb) => {
      loadDomainPlugin(path.join(domainRoot, subdir), cb);
    }, callback);
  });
};

const loadDomainPlugin = function (pluginRoot, callback) {
  const startTs = Date.now();
  logger.debug('Loading plugin', {
    service: 'control',
    pluginRoot: pluginRoot
  });

  let deps = null;
  let plugin = null;

  const createDir = (cb) => {
    if (cachePath !== null) {
      return cb(null);
    }

    tmp.dir({prefix: 'npm-cache-'}, (err, cp) => {
      cachePath = cp;
      cb(err);
    });
  };

  const parseDependencies = (cb) => {
    fs.readFile(path.join(pluginRoot, 'package.json'), {encoding: 'utf-8'}, (err, doc) => {
      if (err) return cb(err);

      let depDoc = {};
      try {
        depDoc = JSON.parse(doc);
      } catch (e) {
        return cb(e);
      }

      deps = [];
      for (let key in depDoc.dependencies) {
        deps.push(key + '@' + depDoc.dependencies[key]);
      }

      cb(null);
    });
  };

  const installDependencies = (cb) => {
    npm.load({cache: cachePath}, (err) => {
      if (err) return cb(err);

      npm.commands.install(pluginRoot, deps, (err, result) => {
        if (err) return cb(err);

        logger.debug('Plugin dependencies installed', {
          service: 'control',
          pluginRoot: pluginRoot,
          duration: Date.now() - startTs
        });

        const requireTs = Date.now();
        try {
          plugin = require(pluginRoot);
        } catch (e) {
          return callback(e);
        }

        logger.debug('Plugin required', {
          service: 'control',
          pluginRoot: pluginRoot,
          duration: Date.now() - requireTs
        });

        cb(null);
      });
    });
  };

  async.series([
    createDir,
    parseDependencies,
    installDependencies
  ], (err) => {
    return callback(err, plugin);
  });
};

const loadTemplates = function (callback) {
  const startTs = Date.now();
  const templatesRoot = PathService.getTemplatesRoot();
  logger.debug('Beginning template preload', {
    service: 'control',
    templatesRoot
  });

  subdirectories(templatesRoot, (err, subdirs) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // No templates to load in this control repository.
        logger.debug('No templates to load', {
          service: 'control',
          duration: Date.now() - startTs
        });

        return callback(null, {});
      }

      return callback(err);
    }

    async.map(subdirs, (subdir, cb) => {
      var fullPath = path.resolve(templatesRoot, subdir);

      createAtomicLoader(fullPath, cb);
    }, (err, results) => {
      if (err) return callback(err);

      const output = {};
      for (var i = 0; i < results.length; i++) {
        output[subdirs[i]] = results[i];
      }

      logger.debug('Successfully preloaded templates', {
        service: 'control',
        domains: subdirs,
        duration: Date.now() - startTs
      });

      callback(null, output);
    });
  });
};
