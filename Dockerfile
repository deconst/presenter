FROM alpine:3.2

RUN apk add --update nodejs git && rm -rf /var/cache/apk/*

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN adduser -D -s /bin/sh presenter
RUN npm install -g nodemon
RUN mkdir -p /home/presenter /usr/src/app && chown -R presenter:presenter /home/presenter

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

CMD ["/usr/src/app/script/prod"]
