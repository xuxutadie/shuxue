/* 学生账号管理：弹窗始终绑定打开时的学生，避免切换档案后改错账号。 */
function studentAdminButtons(p) {
 return `<div class="controls">${button('预览学生模式','student-preview','quiet',`data-student="${p.id}"`)}${button('编辑资料','student-edit','quiet',`data-student="${p.id}"`)}${button(p.accountDisabled?'恢复账号':'停用账号','student-status','quiet',`data-student="${p.id}"`)}${button('删除账号','student-delete','quiet',`data-student="${p.id}"`)}</div>`;
}
function openStudentAdmin(action,id) {
 if(!teacher)throw new Error('此功能仅教师可用。');
 const p=overview.students.find(s=>s.id===id);
 if(!p)throw new Error('学生资料已变化，请刷新后再试。');
 const identity=`<p><b>${esc(p.name)}</b> · ${esc(p.username)} · ${esc(p.className)}</p>`;
 let fields,heading,submit;
 if(action==='student-edit') {
  heading='编辑学生资料';submit='保存资料';
  fields=`<p>学习记录和成绩会随学生保留。修改登录账号或所属班级后，学生需要重新登录。</p><div class="field"><label for="edit-student-name">学生姓名或昵称</label><input id="edit-student-name" name="name" value="${esc(p.name)}" maxlength="40" required></div><div class="field"><label for="edit-student-username">登录账号</label><input id="edit-student-username" name="username" value="${esc(p.username)}" pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}" maxlength="40" required><small>3至40位字母、数字、下划线或短横线。</small></div><div class="field"><label for="edit-student-class">所属班级</label><select id="edit-student-class" name="classId">${overview.classes.map(c=>`<option value="${c.id}" ${c.id===p.classId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`;
 } else if(action==='student-status') {
  heading=p.accountDisabled?'恢复学生账号':'停用学生账号';submit=p.accountDisabled?'确认恢复':'确认停用';
  fields=`<p>${p.accountDisabled?'恢复后，学生可以用原账号和密码登录。':'停用后，学生当前登录立即失效，并且无法再次登录。'}</p><p>成绩、错题和学习记录会保留，老师仍可查看，之后可以恢复账号。</p><input type="hidden" name="accountDisabled" value="${!p.accountDisabled}">`;
 } else {
  heading='永久删除学生账号';submit='确认永久删除';
  fields=`<p class="notice">此操作会永久删除该学生的账号、测评成绩、错题、课堂记录和 AI 练习记录，无法在网站内恢复。如果只是暂时不再上课，请关闭弹窗后选择“停用账号”。</p><div class="field"><label for="delete-student-confirm">输入登录账号 ${esc(p.username)}，确认删除</label><input id="delete-student-confirm" name="confirmUsername" autocomplete="off" required></div>`;
 }
 modal(`<h2>${heading}</h2>${identity}<form id="student-admin-form" data-student="${p.id}" data-operation="${action}">${fields}<p class="form-error" role="alert"></p><button type="submit">${submit}</button></form>`);
}
async function saveStudentAdmin(form) {
 if(!teacher)throw new Error('此功能仅教师可用。');
 const id=form.dataset.student,operation=form.dataset.operation,e=form.elements;
 let body;
 if(operation==='student-edit')body={name:e.name.value,username:e.username.value,classId:e.classId.value};
 else if(operation==='student-status')body={accountDisabled:e.accountDisabled.value==='true'};
 else body={confirmUsername:e.confirmUsername.value};
 await api(`/api/teacher/students/${id}`,{method:operation==='student-delete'?'DELETE':'PATCH',body});
 dialog.close();
 if(operation==='student-delete' && state.current===id)state.current=null;
 toast(operation==='student-delete'?'学生账号及关联学习记录已删除。':operation==='student-edit'?'学生资料已更新，学习记录已保留。':body.accountDisabled?'账号已停用，学习记录已保留。':'账号已恢复，可以重新登录。');
 await render({fresh:true});
}
