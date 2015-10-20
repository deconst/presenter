FROM alpine:3.2

RUN apk add --update nodejs && rm -rf /var/cache/apk/*

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN adduser -D node
RUN npm install -g nodemon
RUN mkdir -p /home/node /usr/src/app && chown -R node:node /home/node

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

CMD chown -R node:node ${CONTROL_REPO_PATH} && su -c "npm start" node
