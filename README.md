# Aragon Notification Service

## Entities

![diagram](./db.svg)

## Quick Start

### Start Postgres and create a DB and user

```shell
$ docker run -d -p 5433:5432 --name postgres postgres
$ docker exec -i -t postgres createuser -h localhost -U postgres --superuser notification-service
$docker exec -i -t postgres createdb -h localhost -U postgres --owner notification-service notification-service
```

### Env vars

Secrets are stored in `.env` file. For a list of required environment variables check `.env.example`

```shell
$ cp .env.example .env
# update .env with secrets
```

### Docker

#### Build image

`docker build -t notification-service .`

#### Run container
This will run the container and mount the `.env` runtime config at runtime
`docker run -it -p 5000:5000 -v $(pwd)/.env:/app/.env notification-service`
