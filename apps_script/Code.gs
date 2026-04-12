// Google Apps Script backend (doGet / doPost)
const SHEET_NAME = 'Ideas';

function _getSheet(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if(!sheet){ sheet = ss.insertSheet(SHEET_NAME); sheet.appendRow(['id','type','name','details','tags','lastUpdated']); }
  return sheet;
}

function _respond(obj, code){
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function doGet(e){
  try{
    const sheet = _getSheet();
    const rows = sheet.getDataRange().getValues();
    let headers = rows.shift();
    // Handle malformed header rows like a single cell containing "id | type | name"
    if (headers.length === 1 && String(headers[0]).indexOf('|') > -1) {
      headers = String(headers[0]).split('|').map(s => s.trim());
    } else {
      headers = headers.map(h => String(h).trim());
    }

    // Normalize header names to canonical keys used by the frontend
    function canonical(h) {
      const s = String(h).toLowerCase().replace(/\s+/g, '');
      if (s === 'lastupdated' || s === 'last_updated' || s === 'lastupdatedat') return 'lastUpdated';
      if (s === 'details') return 'details';
      if (s === 'type') return 'type';
      if (s === 'name') return 'name';
      if (s === 'tags') return 'tags';
      if (s === 'id') return 'id';
      return h; // fallback to original
    }

    const canonHeaders = headers.map(canonical);
    const data = rows.map(r => {
      const item = {};
      canonHeaders.forEach((h, i) => item[h] = r[i]);
      return item;
    }).filter(Boolean);
    if(e.parameter && e.parameter.id){
      const id = e.parameter.id;
      const found = data.find(d=>String(d.id)===String(id));
      return _respond({ success:true, data: found || null });
    }
    return _respond({ success:true, data });
  }catch(err){ return _respond({ success:false, error:'SERVER_ERROR', message:err.message }); }
}

function doPost(e){
  try{
    const body = e.postData && e.postData.contents;
    const json = JSON.parse(body);
    const action = json.action;
    if(action==='add') return _add(json);
    if(action==='update') return _update(json);
    if(action==='delete') return _delete(json.id);
    return _respond({ success:false, error:'INVALID_ACTION' });
  }catch(err){ return _respond({ success:false, error:'INVALID_JSON', message:err.message }); }
}

function _nextId(rows){
  const ids = rows.map(r=>Number(r[0])).filter(n=>!isNaN(n));
  return ids.length? Math.max.apply(null, ids)+1 : 1;
}

function _add(obj){
  const sheet = _getSheet();
  const rows = sheet.getDataRange().getValues();
  const id = _nextId(rows.slice(1));
  const now = new Date().toISOString();
  const row = [id, obj.type||'', obj.name||'', obj.details||'', obj.tags||'', now];
  sheet.appendRow(row);
  return _respond({ success:true, data: { id, type:row[1], name:row[2], details:row[3], tags:row[4], lastUpdated:now } });
}

function _update(obj){
  if(!obj.id) return _respond({ success:false, error:'MISSING_ID' });
  const sheet = _getSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for(let r=1;r<rows.length;r++){
    if(String(rows[r][0])===String(obj.id)){
      const now = new Date().toISOString();
      const row = [obj.id, obj.type||rows[r][1], obj.name||rows[r][2], obj.details||rows[r][3], obj.tags||rows[r][4], now];
      sheet.getRange(r+1,1,1,row.length).setValues([row]);
      return _respond({ success:true, data: { id:obj.id, type:row[1], name:row[2], details:row[3], tags:row[4], lastUpdated:now } });
    }
  }
  return _respond({ success:false, error:'ROW_NOT_FOUND' });
}

function _delete(id){
  if(!id) return _respond({ success:false, error:'MISSING_ID' });
  const sheet = _getSheet();
  const rows = sheet.getDataRange().getValues();
  for(let r=1;r<rows.length;r++){
    if(String(rows[r][0])===String(id)){
      sheet.deleteRow(r+1);
      return _respond({ success:true, message:'deleted', id });
    }
  }
  return _respond({ success:false, error:'ROW_NOT_FOUND' });
}
