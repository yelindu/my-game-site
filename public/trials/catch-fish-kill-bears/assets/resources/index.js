System.register("chunks:///_virtual/resources",["./Tone.ts"],(function(){return{setters:[null],execute:function(){}}}));

System.register("chunks:///_virtual/Tone.ts",["./rollupPluginModLoBabelHelpers.js","cc"],(function(i){var o,e,t,n,u,r,l,d,a,s,h;return{setters:[function(i){o=i.applyDecoratedDescriptor,e=i.inheritsLoose,t=i.initializerDefineProperty,n=i.assertThisInitialized},function(i){u=i.cclegacy,r=i._decorator,l=i.AudioSource,d=i.AudioClip,a=i.CCFloat,s=i.game,h=i.Component}],execute:function(){var c,p,m,y,x,I,A,T,f,C,P;u._RF.push({},"00a42MiMKlBS6PUxZRPEqcm","Tone",void 0);var b=r.ccclass,g=r.property;i("Tone",(c=b("Tone"),p=g({type:l}),m=g({type:l}),y=g({type:d}),x=g({type:a,tooltip:"重置时间"}),c((T=o((A=function(i){function o(){for(var o,e=arguments.length,u=new Array(e),r=0;r<e;r++)u[r]=arguments[r];return o=i.call.apply(i,[this].concat(u))||this,t(o,"audio",T,n(o)),t(o,"pourAudio",f,n(o)),t(o,"audioClip",C,n(o)),t(o,"coolTime",P,n(o)),o.audioIndex=-1,o.pourAudioIndex=-1,o.moneyCoolTime=0,o.moneyPourCoolTime=0,o}e(o,i);var u=o.prototype;return u.playPick=function(i,o){void 0===i&&(i=0),void 0===o&&(o=0),s.totalTime<this.moneyCoolTime||(-1==this.audioIndex&&(this.audioIndex=i,this.audioIndex=Math.min(this.audioClip.length-1,this.audioIndex)),this.unschedule(this.clearAudioIndex),this.schedule(this.clearAudioIndex,this.coolTime),this.audioIndex>=this.audioClip.length||(this.audio.playOneShot(this.audioClip[this.audioIndex],1.3),this.audioIndex+=1,this.moneyCoolTime=s.totalTime+o))},u.playPourPick=function(i,o){void 0===i&&(i=0),void 0===o&&(o=0),s.totalTime<this.moneyPourCoolTime||(this.pourAudioIndex=i,this.pourAudioIndex=Math.min(this.audioClip.length-1,this.pourAudioIndex),this.unschedule(this.clearPourAudioIndex),this.schedule(this.clearPourAudioIndex,this.coolTime),this.pourAudioIndex<0||(this.pourAudio.playOneShot(this.audioClip[this.pourAudioIndex],1.3),this.pourAudioIndex-=1,this.moneyPourCoolTime=s.totalTime+o))},u.clearAudioIndex=function(){this.unschedule(this.clearAudioIndex),this.audioIndex=-1,this.moneyCoolTime=0},u.clearPourAudioIndex=function(){this.unschedule(this.clearPourAudioIndex),this.pourAudioIndex=-1,this.moneyPourCoolTime=0},o}(h)).prototype,"audio",[p],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return null}}),f=o(A.prototype,"pourAudio",[m],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return null}}),C=o(A.prototype,"audioClip",[y],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return[]}}),P=o(A.prototype,"coolTime",[x],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return 1e3}}),I=A))||I));u._RF.pop()}}}));

(function(r) {
  r('virtual:///prerequisite-imports/resources', 'chunks:///_virtual/resources'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});