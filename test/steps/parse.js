'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var it = lab.test;

var parser = require('../../lib/steps/parse.js');

lab.experiment('parse.js', function () {
  lab.experiment('without weave', function () {
    [
      'FROM ubuntu\nrrun some stuff\ncmd sleep 99',
      'FROM ubuntu\nruun some stuff\ncmd sleep 99',
      'FROM ubuntu\nrunn some stuff\ncmd sleep 99',
      'FROM ubuntu\nENV NO RUN\ncmd sleep 99',
      'FROM ubuntu\nPORT RUN\ncmd sleep 99',
      'FROM ubuntu\nFOO NO RUN\ncmd sleep 99',
      'FROM ubuntu\nRUNRUN\ncmd sleep 99',
      'FROM ubuntu\nr un some stuff\ncmd sleep 99',
    ].forEach(function(item) {
      it('should NOT add weave', function(done) {
        var dockerfile = parser(item).split('\n');
        expect(dockerfile).to.exist();
        done();
      });
    });
  });

  lab.experiment('with weave', function () {
    var oldEnv = process.env.RUNNABLE_WAIT_FOR_WEAVE;
    lab.before(function(done) {
      process.env.RUNNABLE_WAIT_FOR_WEAVE =
        'until grep -q ethwe /proc/net/dev; do sleep 1; done; ';
      done();
    });

    lab.after(function (done) {
      process.env.RUNNABLE_WAIT_FOR_WEAVE = oldEnv;
      done();
    });

    lab.experiment('valid', function () {
      [
        'FROM ubuntu\nrun some stuff\ncmd sleep 99',
        'FROM ubuntu\nruN some stuff\ncmd sleep 99',
        'FROM ubuntu\nrUn some stuff\ncmd sleep 99',
        'FROM ubuntu\nrUN some stuff\ncmd sleep 99',
        'FROM ubuntu\nRun some stuff\ncmd sleep 99',
        'FROM ubuntu\nRuN some stuff\ncmd sleep 99',
        'FROM ubuntu\nRUn some stuff\ncmd sleep 99',
        'FROM ubuntu\nRUN some stuff\ncmd sleep 99',
        'FROM ubuntu\nRUN some stuff \ncmd sleep 99',
        'FROM ubuntu\n RUN some stuff\ncmd sleep 99',
        'FROM ubuntu\n RUN some stuff \ncmd sleep 99',
        'FROM ubuntu\n RUN  some stuff \ncmd sleep 99',
        'FROM ubuntu\n RUN \tsome stuff \ncmd sleep 99',
      ].forEach(function(item) {
        it('should add weave to correct line', function(done) {
          var dockerfile = parser(item).split('\n');
          expect(dockerfile[0])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[1])
            .to.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          done();
        });
      });

      it('should add weave to both lines', function(done) {
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
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
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
          .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
        done();
      });
    });

    lab.experiment('invalid', function () {
      [
        'FROM ubuntu\nrrun some stuff\ncmd sleep 99',
        'FROM ubuntu\nruun some stuff\ncmd sleep 99',
        'FROM ubuntu\nrunn some stuff\ncmd sleep 99',
        'FROM ubuntu\nENV NO RUN\ncmd sleep 99',
        'FROM ubuntu\nPORT RUN\ncmd sleep 99',
        'FROM ubuntu\nFOO NO RUN\ncmd sleep 99',
        'FROM ubuntu\nRUNRUN\ncmd sleep 99',
        'FROM ubuntu\nr un some stuff\ncmd sleep 99',
      ].forEach(function(item) {
        it('should NOT add weave', function(done) {
          var dockerfile = parser(item).split('\n');
          expect(dockerfile[0])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[1])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          expect(dockerfile[2])
            .to.not.contain(process.env.RUNNABLE_WAIT_FOR_WEAVE);
          done();
        });
      });
    });
  });
});