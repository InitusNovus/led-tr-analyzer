export const CIRCUIT_TEMPLATES = Object.freeze({
  resistor:{instances:['RLED','LED1'],connections:[['VLED','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND']]},
  'gpio-source':{instances:['GPIO1','RLED','LED1'],connections:[['GPIO1.PIN','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND']]},
  'gpio-sink':{instances:['RLED','LED1','GPIO1'],connections:[['VLED','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GPIO1.PIN']]},
  'digital-npn':{instances:['GPIO1','Q1','Q1.R1','Q1.R2','RLED','LED1'],connections:[['VLED','RLED.1'],['RLED.2','LED1.A'],['LED1.K','Q1.C'],['Q1.E','GND'],['GPIO1.PIN','Q1.IN'],['Q1.R1','Q1.B'],['Q1.R2','Q1.E']]},
  'npn-low':{instances:['GPIO1','RB','Q1','RLED','LED1'],connections:[['VLED','RLED.1'],['RLED.2','LED1.A'],['LED1.K','Q1.C'],['Q1.E','GND'],['GPIO1.PIN','RB.1'],['RB.2','Q1.B']]},
  'npn-follower':{instances:['GPIO1','RB','Q1','RLED','LED1'],connections:[['VLED','Q1.C'],['Q1.E','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND'],['GPIO1.PIN','RB.1'],['RB.2','Q1.B']]},
  'npn-current-sink':{instances:['GPIO1','RB','Q1','RE','RLED','LED1'],connections:[['VLED','RLED.1'],['RLED.2','LED1.A'],['LED1.K','Q1.C'],['Q1.E','RE.1'],['RE.2','GND'],['GPIO1.PIN','RB.1'],['RB.2','Q1.B']]},
  'nmos-low':{instances:['GPIO1','RG','RGS','Q1','RLED','LED1'],connections:[['VLED','RLED.1'],['RLED.2','LED1.A'],['LED1.K','Q1.D'],['Q1.S','GND'],['GPIO1.PIN','RG.1'],['RG.2','Q1.G'],['Q1.G','RGS.1'],['RGS.2','GND']]},
  'pnp-high':{instances:['GPIO1','RB','Q1','RLED','LED1'],connections:[['VLED','Q1.E'],['Q1.C','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND'],['GPIO1.PIN','RB.1'],['RB.2','Q1.B']]},
  'pmos-high':{instances:['GPIO1','RG','RGS','Q1','RLED','LED1'],connections:[['VLED','Q1.S'],['Q1.D','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND'],['GPIO1.PIN','RG.1'],['RG.2','Q1.G'],['Q1.G','RGS.1'],['RGS.2','VLED']]},
  'npn-pnp':{instances:['GPIO1','RB','Q1','Rdrive','RBE','Q2','RLED','LED1'],connections:[['GPIO1.PIN','RB.1'],['RB.2','Q1.B'],['Q1.E','GND'],['Q1.C','Rdrive.1'],['Rdrive.2','Q2.B'],['Q2.B','RBE.1'],['RBE.2','VLED'],['VLED','Q2.E'],['Q2.C','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND']]},
  'npn-pmos':{instances:['GPIO1','RB','Q1','Rdrive','RGS','Q2','RLED','LED1'],connections:[['GPIO1.PIN','RB.1'],['RB.2','Q1.B'],['Q1.E','GND'],['Q1.C','Rdrive.1'],['Rdrive.2','Q2.G'],['Q2.G','RGS.1'],['RGS.2','VLED'],['VLED','Q2.S'],['Q2.D','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND']]},
  'nmos-pmos':{instances:['GPIO1','RG','RGS_IN','Q1','Rdrive','RGS_OUT','Q2','RLED','LED1'],connections:[['GPIO1.PIN','RG.1'],['RG.2','Q1.G'],['Q1.G','RGS_IN.1'],['RGS_IN.2','GND'],['Q1.S','GND'],['Q1.D','Rdrive.1'],['Rdrive.2','Q2.G'],['Q2.G','RGS_OUT.1'],['RGS_OUT.2','VLED'],['VLED','Q2.S'],['Q2.D','RLED.1'],['RLED.2','LED1.A'],['LED1.K','GND']]},
});
export function circuitTemplate(id){return CIRCUIT_TEMPLATES[id]??null;}
