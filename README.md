# Aragon Notification Service

A node.js service to manage ethereum blockchain subscriptions and alert on specific events.

## Architecture

The service exposes a REST API for:

- creating accounts
- passwordless logins with email tokens
- managing subscriptions

The service has two async jobs:

- scan ethereum blockchain for new events, match with subscriptions and queue emails
- send queued notifications emails

## Stack

- PostgreSQL as the main persistence layer.
- Knex.js to build SQL queries
- hapi.js for the REST API
- jsonwebtoken for signing JWT auth tokens

## Authentication / Authorisation

The system has no concept of passwords.

Authentication is done by calling the login endpoint which:

1. Issues a short lived token
2. Sends an email with the magic link (a link containing the JWT signed token)
3. Once the magiclink token is send to the `/verify` endpoint a long lived auth token allows interaction with the full API

Hence, two auth scopes are defined:

- MAGICLINK
- API

Tokens are stateful, i.e. they're validated on every request. So even though we use JWT tokens, they can be invalidated from the DB.

## Entities

![diagram](./db.svg)

## Quick Start

### Start Postgres and create a DB and user

```shell
$ docker run -d -p 5433:5432 --name postgres postgres
$ docker exec -i -t postgres createuser -h localhost -U postgres --superuser notification-service
$ docker exec -i -t postgres createdb -h localhost -U postgres --owner notification-service notification-service
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

## DB relational model diagram

To update use https://draw.io and open the `db.drawio` file in the repository.
