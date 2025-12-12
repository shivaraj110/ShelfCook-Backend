FROM oven/bun:1 as base

WORKDIR /app

COPY package* ./

RUN bun install

COPY . .

EXPOSE 3000

EXPOSE 4000

CMD ["bun", "run", "serve-express"]
