FROM php:8.4-apache

RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev libonig-dev libzip-dev unzip \
    && docker-php-ext-install pdo_pgsql mbstring zip opcache \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY apps/api-overlay/ ./
RUN mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache
COPY deploy/api/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/api/php.ini /usr/local/etc/php/conf.d/irminsul.ini
COPY deploy/api/start.sh /usr/local/bin/irminsul-start
RUN sed -i 's/\r$//' /usr/local/bin/irminsul-start && chmod +x /usr/local/bin/irminsul-start
EXPOSE 80
CMD ["irminsul-start"]
