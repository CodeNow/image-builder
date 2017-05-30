'use strict'

const Bluebird = require('bluebird')
const fs = require('fs')
const vault = require('node-vault')
const utils = require('../utils')

class VaultManager {
  constructor () {
    const vaultPath = process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH
    if (vaultPath) {
      try {
        const fileContent = fs.readFileSync(vaultPath, 'utf8')
        const vaultToken = fileContent.trim()
        this._vaultOpts = {
          apiVersion: 'v1',
          endpoint: process.env.RUNNABLE_VAULT_ENDPOINT,
          token: vaultToken
        }
        this._vault = vault(this._vaultOpts)
      } catch (err) {
        utils.log('token file not found')
      }
    }
  }

  /**
   * Return password for a specific org's `process.env.RUNNABLE_ORG_ID`
   * docker registry
   * @resolves {Object} response object with nested `data.value` key which has password
   * @rejects {Error} if vault client was not initialized properly
   */
  readRegistryPassword () {
    const self = this
    return Bluebird.try(function () {
      if (!self._vault) {
        throw new Error('Vault was not configured')
      }
    })
      .then(function () {
        const keyPath = `secret/organization/${process.env.RUNNABLE_ORG_ID}/registry/password`
        return self._vault.read(keyPath)
      })
  }

  readUserSSHKey (userId) {
    const self = this
    return Bluebird.try(function () {
      if (!self._vault) {
        throw new Error('Vault was not configured')
      }
    })
      .then(function () {
        const keyPath = `secret/organization/${process.env.RUNNABLE_ORG_ID}/ssh-keys/${userId}`
        return self._vault.read(keyPath)
      })
  }
}

module.exports = new VaultManager()
module.exports._VaultManager = VaultManager
