FROM node:20-alpine
WORKDIR /app
COPY package.json focus-nfce.js server.js ./
ENV NODE_ENV=production
USER node
EXPOSE 5100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:5100/health || exit 1
CMD ["node", "server.js"]
