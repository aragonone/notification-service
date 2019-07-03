# Aragon Notification Service

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

## CI/CD

Google Cloud Build is used to build the project. The definition is in the [cloudbuild.yaml file](./cloudbuild.yaml)

1. Build the Docker Image
1. Push Docker image to GCR (Google Cloud Registry)
1. Use [Cloud KMS](https://cloud.google.com/kms/) (Key management Service) to decrypt the secrets
1. Apply the k8s manifests
1. Update the k8s deployment image tag

## Secrets

To commit changes to secrets:

```shell

# Decrypt first
$ gcloud kms decrypt --location global \
  --keyring aragon-production --key notification-service \
  --plaintext-file k8s/secrets.yaml \
  --ciphertext-file k8s/secrets.yaml.enc

# Update k8s/secrets.yaml

# Encrypt
$ gcloud kms encrypt --location global \
  --keyring aragon-production --key notification-service \
  --plaintext-file k8s/secrets.yaml \
  --ciphertext-file k8s/secrets.yaml.enc

$ git commit k8s/secrets.yaml.enc -m "Updated secrets"
```


## Postgres

Google Cloud SQL is used as a managed Postgres instance. To connect from a [local machine follow this guide](https://cloud.google.com/sql/docs/postgres/connect-admin-proxy).

### TL;DR
```
$ cloud_sql_proxy -instances=aragon-core:us-central1:aragon-postgres=tcp:5432
$ psql "host=127.0.0.1 sslmode=disable dbname=<DB_NAME> user=<USER_NAME>"
```
