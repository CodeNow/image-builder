'use strict'

const fs = require('fs')
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const expect = require('code').expect
const sinon = require('sinon')
const vault = require('../../lib/external/vault')

lab.experiment('vault.js unit test', () => {
  lab.beforeEach((done) => {
    sinon.stub(fs, 'readFileSync').returns('vault-token\n ')
    process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH = '/some-path'
    process.env.RUNNABLE_VAULT_ENDPOINT = 'endpoint-for-vault'
    process.env.RUNNABLE_ORG_ID = 111
    done()
  })
  lab.afterEach((done) => {
    fs.readFileSync.restore()
    delete process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH
    delete process.env.RUNNABLE_VAULT_ENDPOINT
    delete process.env.RUNNABLE_ORG_ID
    done()
  })
  lab.experiment('valid', () => {
    lab.it('should be initialized', (done) => {
      const vaultInstance = new vault._VaultManager()
      expect(vaultInstance._vault).to.exist()
      expect(vaultInstance._vaultOpts.apiVersion).to.equal('v1')
      expect(vaultInstance._vaultOpts.endpoint).to.equal('endpoint-for-vault')
      expect(vaultInstance._vaultOpts.token).to.equal('vault-token')
      sinon.assert.calledOnce(fs.readFileSync)
      sinon.assert.calledWithExactly(fs.readFileSync,
        process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH, 'utf8')
      done()
    })
    lab.it('should return password', (done) => {
      const vaultInstance = new vault._VaultManager()
      sinon.stub(vaultInstance._vault, 'read').returns('password')
      const result = vaultInstance.readRegistryPassword()
      expect(result).to.equal('password')
      sinon.assert.calledOnce(vaultInstance._vault.read)
      const passwordPath = 'secret/organization/111/registry/password'
      sinon.assert.calledWithExactly(vaultInstance._vault.read, passwordPath)
      done()
    })
  })
  lab.experiment('invalid', function () {
    lab.it('should not be initialized if token path was not set', (done) => {
      delete process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH
      const vaultInstance = new vault._VaultManager()
      expect(vaultInstance._vault).to.not.exist()
      sinon.assert.notCalled(fs.readFileSync)
      done()
    })
    lab.it('should throw an error when trying to read password from unset vault', (done) => {
      delete process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH
      const vaultInstance = new vault._VaultManager()
      expect(vaultInstance.readRegistryPassword).to.throw(Error, /Vault was not configured/)
      done()
    })
  })
})
