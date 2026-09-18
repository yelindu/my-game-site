System.register("chunks:///_virtual/AutoLabel.ts",["./rollupPluginModLoBabelHelpers.js","cc","./Language.ts"],(function(e){var t,r,a,i,n,o,u,l,c;return{setters:[function(e){t=e.applyDecoratedDescriptor,r=e.inheritsLoose,a=e.initializerDefineProperty,i=e.assertThisInitialized},function(e){n=e.cclegacy,o=e._decorator,u=e.Label,l=e.Component},function(e){c=e.Language}],execute:function(){var s,p,b,f,h,y,d,g,m,z,k,L,N,_,w,v,C,j,A;n._RF.push({},"c240ak22ChKY62Oq25S8KHK","AutoLabel",void 0);var T=o.ccclass,D=o.property;e("AutoLabel",(s=T("AutoLabel"),p=D({displayName:"中文(简体)"}),b=D({displayName:"中文(繁体)"}),f=D({displayName:"英文"}),h=D({displayName:"日文"}),y=D({displayName:"韩文"}),d=D({displayName:"法文"}),g=D({displayName:"德文"}),m=D({displayName:"俄文"}),s((L=t((k=function(e){function t(){for(var t,r=arguments.length,n=new Array(r),o=0;o<r;o++)n[o]=arguments[o];return t=e.call.apply(e,[this].concat(n))||this,a(t,"zh_CN",L,i(t)),a(t,"zh_TW",N,i(t)),a(t,"en",_,i(t)),a(t,"ja",w,i(t)),a(t,"ko",v,i(t)),a(t,"fr",C,i(t)),a(t,"de",j,i(t)),a(t,"ru",A,i(t)),t}r(t,e);var n=t.prototype;return n.onLoad=function(){var e="";switch(c.getLanguageCode()){case"zh-s":e=this.zh_CN;break;case"zh_t":e=this.zh_TW;break;case"en":e=this.en;break;case"ja":e=this.ja;break;case"ko":e=this.ko;break;case"fr":e=this.fr;break;case"de":e=this.de;break;case"ru":e=this.ru;break;case"default":e=this.en}this.getComponent(u).string=e},n.start=function(){},n.update=function(e){},t}(l)).prototype,"zh_CN",[p],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),N=t(k.prototype,"zh_TW",[b],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),_=t(k.prototype,"en",[f],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),w=t(k.prototype,"ja",[h],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),v=t(k.prototype,"ko",[y],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),C=t(k.prototype,"fr",[d],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),j=t(k.prototype,"de",[g],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),A=t(k.prototype,"ru",[m],{configurable:!0,enumerable:!0,writable:!0,initializer:function(){return""}}),z=k))||z));n._RF.pop()}}}));

System.register("chunks:///_virtual/Language.ts",["cc"],(function(e){var a,s,n;return{setters:[function(e){a=e.cclegacy,s=e.resources,n=e.sys}],execute:function(){a._RF.push({},"96f3bOgXvRBRIiiT/t1AgXs","Language",void 0),e("Language",function(){function e(){}return e.init=function(e,a){void 0===e&&(e=null),this.languageCode||this.getLanguageCode(),e||(e="texture"),s.loadDir(e+"/"+this.languageCode,(function(){a&&a()}))},e.getLanguageCode=function(){if(this.languageCode)return this.languageCode;var e="";switch(n.languageCode){case"zh":case"zh-cn":case"zh_CN":e="zh-s";break;case"zh-tw":case"zh_TW":e="zh-t";break;case"fr":e="fr";break;case"en":case"it":case"de":e="de";break;case"es":case"du":case"hu":case"pt":case"no":case"pl":case"tr":case"uk":case"ro":case"bg":case"hi":case"unknown":e="en";break;case"ru":e="ru";break;case"ja":e="ja";break;case"ar":e="en";break;case"ko":e="ko"}return this.languageCode=e,this.languageCode},e}()).languageCode=null,a._RF.pop()}}}));

System.register("chunks:///_virtual/resources",["./AutoLabel.ts","./Language.ts"],(function(){return{setters:[null,null],execute:function(){}}}));

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