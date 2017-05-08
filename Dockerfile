FROM node:4.2.2

RUN mkdir $HOME/.ssh
RUN ssh-keyscan -H -p 22 github.com >> $HOME/.ssh/known_hosts

RUN apt-get update && apt-get installdocker-ce
VOLUME /var/run/docker.sock
VOLUME /cache
ADD . /source

WORKDIR /source
CMD ["/source/dockerBuild.sh"]
