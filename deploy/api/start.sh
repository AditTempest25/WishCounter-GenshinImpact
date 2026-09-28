#!/bin/sh
set -eu
: "${APP_KEY:?Set a stable Laravel APP_KEY before deploying}"
: "${DB_URL:?Set the Neon PostgreSQL connection URL before deploying}"
export APP_ENV=production
export APP_DEBUG=false
export DB_CONNECTION=pgsql
export DB_SSLMODE=require
export LOG_CHANNEL=stderr
export SESSION_DRIVER=database
export CACHE_STORE=database
export QUEUE_CONNECTION=sync
# mod_php requires prefork. Normalize enabled MPMs before starting Apache,
# including when package updates have enabled an additional default MPM.
a2dismod -f mpm_event mpm_worker
a2enmod mpm_prefork
apache2ctl -t
php artisan config:cache
php artisan migrate --force --no-interaction
php artisan route:cache
exec apache2-foreground
