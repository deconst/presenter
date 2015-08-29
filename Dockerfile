FROM node:0.12.1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN useradd node
RUN npm install -g nodemon
RUN mkdir -p /home/node /usr/src/app && chown -R node:node /home/node

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

CMD chown -R node:node /var/control-repo && su -c "npm start" node
