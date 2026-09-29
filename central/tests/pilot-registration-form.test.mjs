import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const source=readFileSync(new URL('../components/pilots-screen.tsx',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function RecordSheet('),source.indexOf('function PendingFormSheet('));
const tags=[...new Set([...functions.matchAll(/<([A-Z][A-Za-z0-9.]*)/g)].map(m=>m[1]))].filter(name=>!['Record','Serie','RegistrationField','PromotionPanel'].includes(name));
const icons=['Trophy','UserRound','UserPlus','MessageCircle','ClipboardList','X'];
let states=[],cursor=0;
globalThis.pilotFormTest={React,useState(initial){const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}];}};
const code=ts.transpileModule('const {React,useState}=globalThis.pilotFormTest; const cn=(...v)=>v.filter(Boolean).join(" "); const makeWhatsappUrl=()=>null; '+[...new Set([...tags,...icons])].map(name=>'const '+name+'="'+name+'";').join('')+functions+'; export {RecordSheet,RegistrationField};',{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
const {RecordSheet,RegistrationField}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function elements(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(elements);return [node,...elements(node.props?.children)];}

test('one Save registration button persists typed fields before the selected series and entry',async()=>{
 states=[];const saved=[];
 const props={record:{kind:'fila',id:'FIL001',apelido:'Piloto',nomeCompleto:'Original',ativo:true,cadastroStatus:null},raceData:{competicoes:[],divisoes:[],pilotos:[],resultados:[]},editable:true,isAdmin:true,campeonatoIniciado:false,cashEntries:[],saveStatus:null,
 onSave:async(field,value)=>{saved.push([field,value]);return true},onPromote:async(serie,situacao)=>{saved.push(['assignment',serie,situacao]);return true}};
 const render=()=>{cursor=0;return RecordSheet(props)};
 let tree=render();
 const name=elements(tree).find(element=>element.type===RegistrationField&&element.props.field==='nomeCompleto');
 const input=elements(RegistrationField(name.props)).find(element=>element.type==='input');
 input.props.onChange({target:{value:'Nome editado'}});
 const assignment=elements(tree).find(element=>typeof element.type==='function'&&element.type.name==='PromotionPanel');
 assignment.props.onChange({serie:'B',situacao:'suplente'});
 assert.deepEqual(saved,[],'typing and choosing entry must not persist immediately');
 tree=render();
 const buttons=elements(tree).filter(element=>element.type==='button'&&element.props.children==='Salvar cadastro');
 assert.equal(buttons.length,1);
 await buttons[0].props.onClick();
 assert.deepEqual(saved,[['nomeCompleto','Nome editado'],['assignment','B','suplente']]);
});

test('a failed field save keeps the draft and does not allocate the pilot',async()=>{
 states=[];let promoted=false;
 const props={record:{kind:'fila',id:'FIL001',apelido:'Piloto',ativo:true},raceData:{competicoes:[],divisoes:[],pilotos:[],resultados:[]},editable:true,isAdmin:true,campeonatoIniciado:false,cashEntries:[],saveStatus:null,onSave:async()=>false,onPromote:async()=>{promoted=true;return true}};
 const render=()=>{cursor=0;return RecordSheet(props)};
 let tree=render();
 await elements(tree).find(element=>element.type===RegistrationField&&element.props.field==='apelido').props.onSave('apelido','Alterado');
 elements(tree).find(element=>typeof element.type==='function'&&element.type.name==='PromotionPanel').props.onChange({serie:'A',situacao:'ativo'});
 tree=render();await elements(tree).find(element=>element.type==='button'&&element.props.children==='Salvar cadastro').props.onClick();
 assert.equal(promoted,false);
 tree=render();assert.equal(elements(tree).find(element=>element.type===RegistrationField&&element.props.field==='apelido').props.value,'Alterado');
 assert.match(elements(tree).find(element=>element.props?.role==='status').props.children,/Não foi possível salvar/);
});
