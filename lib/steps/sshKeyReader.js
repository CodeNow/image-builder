'use strict';

const Promise = require('bluebird')
const fs = require('fs')
Promise.promisifyAll(fs)
const vault = require('../external/vault')
const utils = require('../utils')

module.exports = {
  createSSHKeys: () => {
    const sshPath = '/root/.ssh/'
    const keyUserIds = process.env.SSH_KEY_IDS.split(',')
    let keyCreators = keyUserIds.map((id) => {
      return vault.readUserSSHKey(id)
        .then((key) => {
          if (key) {
            return fs.writeFileAsync(sshPath + id, key.data.value)
          }
        })
    })
    return Promise.all(keyCreators)
  },

  addToKeyring: (dockerfile) => {
    let startIndex = 2
    const sshPath = '/root/.ssh/'
    const keyUserIds = process.env.SSH_KEY_IDS.split(',')
    dockerfile.splice(startIndex, 0, 'RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
    keyUserIds.forEach((keyName) => {
      let keyPath = sshPath + keyName
      dockerfile.splice(++startIndex, 0, 'RUN chmod 0600 ' + keyPath + ' ' + '&& echo "IdentityFile ' + keyPath + ' >> /etc/ssh/ssh_config')
    })
    return dockerfile
  }
}
