FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . ./

# A Cloud Run Job runs this process to completion; it does not expose an HTTP port.
CMD ["npm", "start"]
