import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Workbench, validateCatalog, resolveSelection, previewUrl, patternGardenReferences } from '../dist/index.js';
const entry = {id:'button',name:'Button',group:'Controls',source:'Button.tsx',description:'A generic button',variants:['Default','Disabled'],width:400};
test('standalone package renders without a host framework',()=>{const html=renderToStaticMarkup(createElement(Workbench,{project:'Fixture',projectId:'fixture',basePath:'/design',entries:[entry]}));assert.match(html,/Design workbench/);assert.match(html,/Button/);});
test('selection URLs preserve identity and normalize unknown states',()=>{const selected=resolveSelection([entry],new URLSearchParams('component=button&state=Disabled&viewport=375'));assert.equal(selected.state,'Disabled');assert.equal(previewUrl('/design',entry,selected),'/design/button?design=current&state=Disabled');assert.equal(resolveSelection([entry],new URLSearchParams('state=unknown')).state,'Default');assert.deepEqual(validateCatalog([entry]),[]);assert.ok(validateCatalog([entry,entry]).length);});
test('PatternGarden adapter preserves provenance and excludes unsafe URLs',()=>{const refs=patternGardenReferences({name:'Example',canonicalUrl:'https://example.com',limitations:['Public page only.'],captures:[{id:'capture-1',patternGardenUrl:'http://127.0.0.1:4317/library/capture-1/reference.md'},{id:'bad',patternGardenUrl:'javascript:alert(1)'}]});assert.equal(refs.length,2);assert.match(refs[1].notes,/Public page only/);assert.match(refs[1].title,/capture-1/);});
