FROM bkendall/nodeanddocker:n0.10-d1.6.2

RUN mkdir $HOME/.ssh
RUN ssh-keyscan -H -p 22 github.com >> $HOME/.ssh/known_hosts

RUN npm install -g n
RUN n 4.2.2
ADD package.json /source/package.json
WORKDIR /source
RUN npm install
VOLUME /cache
ADD . /source

CMD ["/source/dockerBuild.sh"]
