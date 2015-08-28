FROM node:0.12.1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN useradd node
RUN npm install -g nodemon
RUN mkdir -p /home/node /usr/src/app && chown -R node:node /home/node
RUN mkdir -p /var/control-repo && chown -R node:node /var/control-repo

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

USER node
CMD [ "npm", "start" ]
