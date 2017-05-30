'use strict';

const Promise = require('bluebird')
const fs = require('fs')
Promise.promisifyAll(fs)

module.exports = {
  addToKeyring: (dockerfile) => {
    let startIndex = 2
    const sshPath = '/.ssh/'
    fs.readdirAsync('/root/.ssh/')
      .then((items) => {
        dockerfile.splice(startIndex, 0, 'RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
        items.forEach((keyName) => {
          console.log(keyName)
          let keyPath = sshPath + keyName
          dockerfile.splice(++startIndex, 0, 'RUN chmod 0400 ' + keyPath + ' ' + '&& echo "IdentityFile ' + keyPath + ' >> /etc/ssh/ssh_config')
        })
      })
      .then((result) => {
        return dockerfile
      })
  }
}
