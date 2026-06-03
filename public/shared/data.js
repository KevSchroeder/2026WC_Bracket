/* ============================================================================
   2026 FIFA World Cup — verified tournament data
   Source: official final draw (5 Dec 2025) + intercontinental & UEFA play-off
   winners decided 26 & 31 Mar 2026. All 48 teams, 12 groups, official bracket.
   Loadable in the browser (globals) and in Node (module.exports).
   ============================================================================ */
(function (root) {
"use strict";

/* FIFA 3-letter code (id) -> name + ISO-3166 alpha-2 flag code (flagcdn.com).
   gb-eng / gb-sct for England / Scotland. */
const TEAMS = {
  MEX:{name:"Mexico",iso:"mx"},        RSA:{name:"South Africa",iso:"za"},
  KOR:{name:"South Korea",iso:"kr"},   CZE:{name:"Czechia",iso:"cz"},
  CAN:{name:"Canada",iso:"ca"},        BIH:{name:"Bosnia & Herzegovina",iso:"ba"},
  QAT:{name:"Qatar",iso:"qa"},         SUI:{name:"Switzerland",iso:"ch"},
  BRA:{name:"Brazil",iso:"br"},        MAR:{name:"Morocco",iso:"ma"},
  HAI:{name:"Haiti",iso:"ht"},         SCO:{name:"Scotland",iso:"gb-sct"},
  USA:{name:"United States",iso:"us"}, PAR:{name:"Paraguay",iso:"py"},
  AUS:{name:"Australia",iso:"au"},     TUR:{name:"Türkiye",iso:"tr"},
  GER:{name:"Germany",iso:"de"},       CUW:{name:"Curaçao",iso:"cw"},
  CIV:{name:"Ivory Coast",iso:"ci"},   ECU:{name:"Ecuador",iso:"ec"},
  NED:{name:"Netherlands",iso:"nl"},   JPN:{name:"Japan",iso:"jp"},
  SWE:{name:"Sweden",iso:"se"},        TUN:{name:"Tunisia",iso:"tn"},
  BEL:{name:"Belgium",iso:"be"},       EGY:{name:"Egypt",iso:"eg"},
  IRN:{name:"Iran",iso:"ir"},          NZL:{name:"New Zealand",iso:"nz"},
  ESP:{name:"Spain",iso:"es"},         CPV:{name:"Cape Verde",iso:"cv"},
  KSA:{name:"Saudi Arabia",iso:"sa"},  URU:{name:"Uruguay",iso:"uy"},
  FRA:{name:"France",iso:"fr"},        SEN:{name:"Senegal",iso:"sn"},
  IRQ:{name:"Iraq",iso:"iq"},          NOR:{name:"Norway",iso:"no"},
  ARG:{name:"Argentina",iso:"ar"},     ALG:{name:"Algeria",iso:"dz"},
  AUT:{name:"Austria",iso:"at"},       JOR:{name:"Jordan",iso:"jo"},
  POR:{name:"Portugal",iso:"pt"},      COD:{name:"DR Congo",iso:"cd"},
  UZB:{name:"Uzbekistan",iso:"uz"},    COL:{name:"Colombia",iso:"co"},
  ENG:{name:"England",iso:"gb-eng"},   CRO:{name:"Croatia",iso:"hr"},
  GHA:{name:"Ghana",iso:"gh"},         PAN:{name:"Panama",iso:"pa"},
};

const GROUPS = {
  A:["MEX","RSA","KOR","CZE"], B:["CAN","BIH","QAT","SUI"],
  C:["BRA","MAR","HAI","SCO"], D:["USA","PAR","AUS","TUR"],
  E:["GER","CUW","CIV","ECU"], F:["NED","JPN","SWE","TUN"],
  G:["BEL","EGY","IRN","NZL"], H:["ESP","CPV","KSA","URU"],
  I:["FRA","SEN","IRQ","NOR"], J:["ARG","ALG","AUT","JOR"],
  K:["POR","COD","UZB","COL"], L:["ENG","CRO","GHA","PAN"],
};
const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const HOSTS = ["MEX","CAN","USA"];

/* Official knockout bracket (match numbers 73-104). See solo build notes:
   ref { t:"W"|"R", g } group winner/runner-up; { t:"T", slot } best-third slot;
   { t:"M", m } winner of a prior match. side L/R/F drives the two-sided layout. */
const BRACKET = [
  {m:74,round:"R32",side:"L",a:{t:"W",g:"E"},b:{t:"T",slot:1},next:89},
  {m:77,round:"R32",side:"L",a:{t:"W",g:"I"},b:{t:"T",slot:2},next:89},
  {m:73,round:"R32",side:"L",a:{t:"R",g:"A"},b:{t:"R",g:"B"},next:90},
  {m:75,round:"R32",side:"L",a:{t:"W",g:"F"},b:{t:"R",g:"C"},next:90},
  {m:83,round:"R32",side:"L",a:{t:"R",g:"K"},b:{t:"R",g:"L"},next:93},
  {m:84,round:"R32",side:"L",a:{t:"W",g:"H"},b:{t:"R",g:"J"},next:93},
  {m:81,round:"R32",side:"L",a:{t:"W",g:"D"},b:{t:"T",slot:5},next:94},
  {m:82,round:"R32",side:"L",a:{t:"W",g:"G"},b:{t:"T",slot:6},next:94},
  {m:76,round:"R32",side:"R",a:{t:"W",g:"C"},b:{t:"R",g:"F"},next:91},
  {m:78,round:"R32",side:"R",a:{t:"R",g:"E"},b:{t:"R",g:"I"},next:91},
  {m:79,round:"R32",side:"R",a:{t:"W",g:"A"},b:{t:"T",slot:3},next:92},
  {m:80,round:"R32",side:"R",a:{t:"W",g:"L"},b:{t:"T",slot:4},next:92},
  {m:86,round:"R32",side:"R",a:{t:"W",g:"J"},b:{t:"R",g:"H"},next:95},
  {m:88,round:"R32",side:"R",a:{t:"R",g:"D"},b:{t:"R",g:"G"},next:95},
  {m:85,round:"R32",side:"R",a:{t:"W",g:"B"},b:{t:"T",slot:7},next:96},
  {m:87,round:"R32",side:"R",a:{t:"W",g:"K"},b:{t:"T",slot:8},next:96},

  {m:89,round:"R16",side:"L",a:{t:"M",m:74},b:{t:"M",m:77},next:97},
  {m:90,round:"R16",side:"L",a:{t:"M",m:73},b:{t:"M",m:75},next:97},
  {m:93,round:"R16",side:"L",a:{t:"M",m:83},b:{t:"M",m:84},next:98},
  {m:94,round:"R16",side:"L",a:{t:"M",m:81},b:{t:"M",m:82},next:98},
  {m:91,round:"R16",side:"R",a:{t:"M",m:76},b:{t:"M",m:78},next:99},
  {m:92,round:"R16",side:"R",a:{t:"M",m:79},b:{t:"M",m:80},next:99},
  {m:95,round:"R16",side:"R",a:{t:"M",m:86},b:{t:"M",m:88},next:100},
  {m:96,round:"R16",side:"R",a:{t:"M",m:85},b:{t:"M",m:87},next:100},

  {m:97, round:"QF",side:"L",a:{t:"M",m:89},b:{t:"M",m:90},next:101},
  {m:98, round:"QF",side:"L",a:{t:"M",m:93},b:{t:"M",m:94},next:101},
  {m:99, round:"QF",side:"R",a:{t:"M",m:91},b:{t:"M",m:92},next:102},
  {m:100,round:"QF",side:"R",a:{t:"M",m:95},b:{t:"M",m:96},next:102},

  {m:101,round:"SF",side:"L",a:{t:"M",m:97},b:{t:"M",m:98}, next:104},
  {m:102,round:"SF",side:"R",a:{t:"M",m:99},b:{t:"M",m:100},next:104},

  {m:104,round:"F",side:"F",a:{t:"M",m:101},b:{t:"M",m:102},next:null},
];

/* Winner-slots (by group) that face a best-third, slot 1..8. */
const THIRD_SLOTS = [
  {slot:1,m:74,group:"E"}, {slot:2,m:77,group:"I"}, {slot:3,m:79,group:"A"},
  {slot:4,m:80,group:"L"}, {slot:5,m:81,group:"D"}, {slot:6,m:82,group:"G"},
  {slot:7,m:85,group:"B"}, {slot:8,m:87,group:"K"},
];

const ROUND_META = {
  R32:{name:"Round of 32",short:"R32"}, R16:{name:"Round of 16",short:"R16"},
  QF:{name:"Quarter-finals",short:"QF"}, SF:{name:"Semi-finals",short:"SF"},
  F:{name:"Final",short:"Final"},
};

const DATA = { TEAMS, GROUPS, GROUP_LETTERS, HOSTS, BRACKET, THIRD_SLOTS, ROUND_META };

if (typeof module !== "undefined" && module.exports) module.exports = DATA;
else Object.assign(root, DATA);   // browser: expose as globals
})(typeof window !== "undefined" ? window : this);
