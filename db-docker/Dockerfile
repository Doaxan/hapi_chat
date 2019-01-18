FROM mysql:latest

ENV MYSQL_ROOT_PASSWORD pass  
ENV MYSQL_DATABASE brave_chat  
ENV MYSQL_USER admin  
ENV MYSQL_PASSWORD pass

ADD setup.sql /docker-entrypoint-initdb.d