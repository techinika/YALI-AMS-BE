FROM node:20-alpine3.17

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci
COPY ./prisma ./prisma
RUN npx prisma generate
COPY . .

RUN npm run build

CMD [ "npm", "start" ]