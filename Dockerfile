FROM bkendall/nodeanddocker:n0.10-d1.6.2

RUN mkdir $HOME/.ssh
RUN ssh-keyscan -H -p 22 github.com >> $HOME/.ssh/known_hosts

ENV ROLLBAR_KEY 2186b2b7e7cb47efb509664b111af427

VOLUME /cache
ADD . /source

WORKDIR /source
CMD ["/source/dockerBuild.sh"]
