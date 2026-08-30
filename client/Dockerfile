FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN npm install -g serve

EXPOSE 10000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]