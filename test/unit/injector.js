'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var it = lab.test;
var beforeEach = lab.beforeEach;

var parser = require('../../lib/steps/injector.js');
var WAIT_FOR_CHARON = ' sleep 10; ';

lab.experiment('injector.js', function () {
  lab.experiment('without weave', function () {
    beforeEach(function(done) {
      delete process.env.RUNNABLE_WAIT_FOR_WEAVE;
      done();
    });

    it('should NOT add weave to various files', function(done) {
      [
        'FROM ubuntu\nrrun some stuff\nWORKDIR home',
        'FROM ubuntu\nruun some stuff\nWORKDIR home',
        'FROM ubuntu\nrunn some stuff\nWORKDIR home',
        'FROM ubuntu\nENV NO RUN\nWORKDIR home',
        'FROM ubuntu\nPORT RUN\nWORKDIR home',
        'FROM ubuntu\nFOO NO RUN\nWORKDIR home',
        'FROM ubuntu\nRUNRUN\nWORKDIR home',
        'FROM ubuntu\nr un some stuff\nWORKDIR home',
        'FROM ubuntu\nr un some stuff\nCMD sleep 1000',
      ].forEach(function(item) {
        var dockerfile = parser(item);
        expect(dockerfile).to.equal(item);
      });
      done();
    });
  });

  lab.experiment('with weave', function () {
    lab.before(function(done) {
      process.env.RUNNABLE_WAIT_FOR_WEAVE =
        'until grep -q ethwe /proc/net/dev; do sleep 1; done; ';
      done();
    });

    lab.after(function (done) {
      delete process.env.RUNNABLE_WAIT_FOR_WEAVE;
      done();
    });

    lab.experiment('valid', function () {
      it('should add weave to RUN line', function(done) {
        [
          'FROM ubuntu\nrun some stuff\nWORKDIR home',
          'FROM ubuntu\nruN some stuff\nWORKDIR home',
          'FROM ubuntu\nrUn some stuff\nWORKDIR home',
          'FROM ubuntu\nrUN some stuff\nWORKDIR home',
          'FROM ubuntu\nRun some stuff\nWORKDIR home',
          'FROM ubuntu\nRuN some stuff\nWORKDIR home',
          'FROM ubuntu\nRUn some stuff\nWORKDIR home',
          'FROM ubuntu\nRUN some stuff\nWORKDIR home',
          'FROM ubuntu\nRUN some stuff \nWORKDIR home',
          'FROM ubuntu\n RUN some stuff\nWORKDIR home',
          'FROM ubuntu\n RUN some stuff \nWORKDIR home',
          'FROM ubuntu\n RUN  some stuff \nWORKDIR home',
          'FROM ubuntu\n RUN \tsome stuff \nWORKDIR home',
        ].forEach(function(item) {
          var dockerfile = parser(item).split('\n');
          expect(dockerfile[0])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[1])
            .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        });
        done();
      });

      it('should add weave to normal CMD line', function(done) {
        [
          'FROM ubuntu\nWORKDIR home\ncmd some stuff',
          'FROM ubuntu\nWORKDIR home\ncmD some stuff',
          'FROM ubuntu\nWORKDIR home\ncMd some stuff',
          'FROM ubuntu\nWORKDIR home\ncMD some stuff',
          'FROM ubuntu\nWORKDIR home\nCmd some stuff',
          'FROM ubuntu\nWORKDIR home\nCmD some stuff',
          'FROM ubuntu\nWORKDIR home\nCMd some stuff',
          'FROM ubuntu\nWORKDIR home\nCMD some stuff',
          'FROM ubuntu\nWORKDIR home\nCMD some stuff ',
          'FROM ubuntu\nWORKDIR home\n CMD some stuff',
          'FROM ubuntu\nWORKDIR home\n CMD some stuff ',
          'FROM ubuntu\nWORKDIR home\n CMD  some stuff ',
          'FROM ubuntu\nWORKDIR home\n CMD \tsome stuff ',
          'FROM ubuntu\nWORKDIR home\n CMD \tsome stuff ',
          'FROM ubuntu\nr un some stuff\nCMD ['
        ].forEach(function(item) {
          var dockerfile = parser(item).split('\n');
          expect(dockerfile[0])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[1])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        });
        done();
      });

      it('should add weave to [] CMD lines normal space', function(done) {
        [
          'FROM ubuntu\nWORKDIR home\ncmd ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\ncmD ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\ncMd ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\ncMD ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\nCmd ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\nCmD ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\nCMd ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\nCMD ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\nCMD [ "a", "b"]',
          'FROM ubuntu\nWORKDIR home\nCMD ["a", "b" ]',
          'FROM ubuntu\nWORKDIR home\nCMD [ "a", "b" ]',
          'FROM ubuntu\nWORKDIR home\nCMD ["a", "b"] ',
          'FROM ubuntu\nWORKDIR home\nCMD ["a", "b"] ',
          'FROM ubuntu\nWORKDIR home\n CMD ["a", "b"]',
          'FROM ubuntu\nWORKDIR home\n CMD ["a", "b"] ',
        ].forEach(function(item) {
          var dockerfile = parser(item).split('\n');
          expect(dockerfile[0])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[1])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE + WAIT_FOR_CHARON + 'a b');
        });
        done();
      });

      it('should add weave to [] CMD lines strange space', function(done) {
        [
          'FROM ubuntu\nWORKDIR home\n CMD \t["a", "b"] ',
          'FROM ubuntu\nWORKDIR home\n CMD \t[ "a" ,"b" ] ',
          'FROM ubuntu\nWORKDIR home\n CMD  ["a", "b"] ',
        ].forEach(function(item) {
          var dockerfile = parser(item).split('\n');
          expect(dockerfile[0])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[1])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.contain('a b');
          expect(dockerfile[2])
            .to.contain(WAIT_FOR_CHARON);
        });
        done();
      });

      it('should add weave to both run lines', function(done) {
        var item = 'FROM ubuntu\nRUN some\nENV T 1\nRUN maur stuff\nENV start';
        var dockerfile = parser(item).split('\n');
        expect(dockerfile[0])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[1])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[2])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[3])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[4])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        done();
      });

      it('should add weave to both run and CMD lines', function(done) {
        var item = 'FROM ubuntu\nRUN some\nENV T 1\nRUN maur stuff\nCMD start';
        var dockerfile = parser(item).split('\n');
        expect(dockerfile[0])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[1])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[2])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[3])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[4])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        done();
      });

      it('should not add weave to second part of run line', function(done) {
        var item = 'FROM ubuntu\nRUN some\\\nrun script\nCMD start';
        var dockerfile = parser(item).split('\n');
        expect(dockerfile[0])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[1])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[2])
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        expect(dockerfile[3])
          .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        done();
      });
    });

    lab.experiment('invalid', function () {
      it('should NOT add weave', function(done) {
        [
          'FROM ubuntu\nrrun some stuff\ncmdd sleep 99',
          'FROM ubuntu\nruun some stuff\ncmmd sleep 99',
          'FROM ubuntu\nrunn some stuff\nccmd sleep 99',
          'FROM ubuntu\nENV NO RUN\nWORKDIR CMD',
          'FROM ubuntu\nPORT RUN\nENV sleep 99',
          'FROM ubuntu\nFOO NO RUN\nBAR NO CMD',
          'FROM ubuntu\nRUNRUN\nCMDCMD sleep 99',
          'FROM ubuntu\nr un some stuff\nyou CMD',
          'FROM ubuntu\nr un some stuff\nCMD[]',
        ].forEach(function(item) {
          expect(parser(item))
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        });
        done();
      });
    });
  });
});
