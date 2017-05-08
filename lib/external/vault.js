'use strict'

const fs = require('fs')
const vault = require('node-vault')

class VaultManager {
  constructor () {
    const fileContent = fs.readFileSync(process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH)
    const vaultToken = fileContent.trim()
    this._vault = vault({
      apiVersion: 'v1',
      endpoint: process.env.RUNNABLE_VAULT_ENDPOINT,
      token: vaultToken
    })
  }

  readRegistryPassword () {
    const keyPath = 'secret/organization/' + process.env.RUNNABLE_ORG_ID + '/registry/password'
    return this._vault.read(keyPath)
  }
}

module.exports = new VaultManager()
