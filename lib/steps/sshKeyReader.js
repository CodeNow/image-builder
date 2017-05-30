'use strict';

const Promise = require('bluebird')
const fs = require('fs')
Promise.promisifyAll(fs)

module.exports = {
  createSSHKeys: () => {
    const sshPath = '/root/.ssh/'
    const keyUserIds = process.env.SSH_KEY_IDS.split(',')
    keyUserIds.forEach((id) => {
      return vault.readUserSSHKey(id)
        .then((key) => {
          fs.writeFile(sshPath + id, key)
            .then((result) => {
              console.log(result)
            })
        })
    })
  },

  addToKeyring: (dockerfile) => {
    let startIndex = 2
    const sshPath = '/root/.ssh/'
    fs.readdirAsync(sshPath)
      .then((items) => {
        dockerfile.splice(startIndex, 0, 'RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
        items.forEach((keyName) => {
          console.log(keyName)
          let keyPath = sshPath + keyName
          dockerfile.splice(++startIndex, 0, 'RUN chmod 0600 ' + keyPath + ' ' + '&& echo "IdentityFile ' + keyPath + ' >> /etc/ssh/ssh_config')
        })
      })
      .then((result) => {
        return dockerfile
      })
  }
}
