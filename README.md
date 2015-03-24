=========
presenter
=========
A component that builds and returns the final document.

Installation
------------
With ``npm`` installed, run ``npm install`` from the root directory.

Configuration
-------------
Set the following environment variables:
``${MAPPING_SERVICE_URL}``: **Required**. URL of the mapping service.
``${CONTENT_SERVICE_URL}``: **Required**. URL of the content service.

Running Locally
---------------
From the command line, run ``node app.js``.

Open a browser window and navigate to [http://localhost:8080](http://localhost:8080).

Running Mock Mapping and Content Services
-----------------------------------------
The repo includes two files for mock services: ``fake_content_service.js`` and ``fake_mapping_service.js``.
To run them, from the command line, run ``node fake_content_service.js`` and ``node fake_mapping_service.js``, respectively.
