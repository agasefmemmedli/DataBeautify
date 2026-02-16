from node:14
workdir /app
copy package.json .
run npm install \
    && npm run build
expose 8080
cmd ["npm", "start"]
