'use strict';

const Promise = require('bluebird')
const fs = require('fs')
Promise.promisifyAll(fs)
const vault = require('../external/vault')
const utils = require('../utils')

module.exports = {
  createSSHKeys: () => {
    const keyUserIds = process.env.SSH_KEY_IDS.split(',')
      .then(() => {
        let keyCreators = keyUserIds.map((id) => {
          return vault.readUserSSHKey(id)
            .then((key) => {
              if (key) {
                return {
                  id,
                  value: key.data.value
                }
              }
            })
        })
        return Promise.all(keyCreators)
          .then((keys) => {
            return keys.map((acc, key) => {
              acc['SSH_KEY_' + [key.id]] = acc.key.value
              return acc
            }, {})
          })
      })
  },

  addToKeyring: (dockerfile) => {
    let startIndex = 2
    const keyUserIds = process.env.SSH_KEY_IDS.split(',')
    const sshPath = '/ssh-keys/'
    dockerfile.splice(startIndex, 0, 'RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
    dockerfile.splice(++startIndex, 0, 'RUN mkdir `${sshPath}`')
    keyUserIds.forEach((keyName) => {
      dockerfile.splice(++startIndex, 0, 'ARG `SSH_KEY_${keyName}`')
      dockerfile.splice(++startIndex, 0, 'RUN echo `$SSH_KEY_${keyName}` >> `${sshPath}${keyName}`')
    })
    keyUserIds.forEach((keyName) => {
      let keyPath = sshPath + keyName
      dockerfile.splice(++startIndex, 0, 'RUN chmod 0600 ' + keyPath + ' ' + '&& echo "IdentityFile ' + keyPath + '" >> /etc/ssh/ssh_config')
      utils.log(keyPath)
    })
    return dockerfile
  }
}
