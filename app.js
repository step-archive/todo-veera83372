const servFile = require('./serverLib/servFile.js');
const fs = require('fs');
const timeStamp = require('./time.js').timeStamp;
const WebApp = require('./webapp');
const TodoApp = require('./lib/TodoApp.js');
let todoApp=new TodoApp(process.env.TODO_STORE||'./data/todoLists.json');
todoApp.loadTodos();

const saveEditedList = function (req,res) {
  let user=req.user.userName;
  let body=req.body;
  todoApp.updateList(user,body.listId,body.title,body.desc);
  res.redirect('/home.html');
}

const listToHTML=function (todoLists) {
  let htmlStr=' ';
  todoLists.forEach((todoList,index)=>{
    htmlStr +=`<input type='text' value='${todoList.getTitle()}'  id='${index}_title' disabled />`
    htmlStr +=`<input type='text' value='${todoList.getDescription()}'  id='${index}_desc' disabled />
    <button type='button' onclick="editList('${index}_title','${index}_desc')" >Edit</button>
    <button type='button' style='display:none'  onclick="saveEditedList('${index}_title','${index}_desc')">save</button>
    <button type='button' onclick="deleteList('${index}_title','${index}_desc')">delete list</button>
    <button type='button' onclick="viewItems('${index}_title','${index}_desc')">view Items</button>
    <br>`;
  });
  return htmlStr;
}

const deleteUserList = function (req,res) {
  let user=req.user.userName;
  console.log(user,req.body.titleId)
  todoApp.deleteTodoList(user,req.body.titleId);
  res.redirect('/home.html');
}
const resourceNotFound = function (req,res) {
  res.statusCode=404;
  res.write('resource not found');
  res.end();
}

const serverUserTodoList= function (req,res) {
  let header={'content-type':'text/html'};
  if(todoApp.todos[req.user.userName])
    return res.respond(listToHTML(todoApp.todos[req.user.userName].todoLists),200,header);
  return res.respond('<b>no lists found</b>',200,header);
}

const getUserInfoAsHtml = function (user) {
  return `<h3> hello ${user.name}
  </h3>
  <a href='/logout' > Logout </a>`;
}

const itemsToHTML =function (todoItems,listId) {
  let htmlStr='';
  todoItems.forEach((item,index)=>{
    htmlStr +=`<input type='checkbox' value='${item.getTitle()}'  id='${index}_${listId}'  >${item.getTitle()}</input>`
    htmlStr +=`<button type='button' onclick="editItem('${index}','${listId}')" >Edit</button>
    <button type='button' style='display:none'  onclick="saveEditedItem('${index}_title','${index}_desc')">save</button>
    <button type='button' onclick="deleteItem('${index}','${index}')">delete Item</button>

    <br>`
  })
  return htmlStr;
}

const addItem = function (req,res) {
  let user=req.user.userName;
  let listId=req.body.listId;
  let title=req.body.title;
  todoApp.todos[user].addTodoItem(listId,title);
  let todoItems=todoApp.todos[user].todoLists[listId].todoItems;
  todoApp.saveTodos();
  let header={
    'content-type':'text/html'
  }
  res.respond(itemsToHTML(todoItems,listId),200,header);
}


const deleteItem = function (req,res) {
  let user=req.user.userName;
  todoApp.deleteListItem(user,req.body.listId,req.body.itemId);
  let todoItems=todoApp.todos[user].todoLists[listId].todoItems;
  let header={
    'content-type':'text/html'
  }
  res.respond(itemsToHTML(todoItems,listId),200,header);
}

const serveUserListItems= function (req,res) {
  let user=req.user.userName;
  let listId=req.body.listId;
  let todoItems=todoApp.todos[user].todoLists[listId].todoItems;
  let header={
    'content-type':'text/html'
  }
  res.respond(itemsToHTML(todoItems,listId),200,header);
}

const addUserTodoList=function (req,res) {
  let user=req.user.userName;
  todoApp.addTodoOfUser(user,req.body.title,req.body.desc);
  res.redirect('/home.html');
}

const redirectLoggedOutUserToLogin = function (req,res) {
  if(req.urlIsOneOf(['/','/home.html','/logout','/addList']) && !req.user)
    res.redirect('login.html');
}

let registered_users = [{userName:'veera',name:'veera venkata durga prasad'}];

let toS = o=>JSON.stringify(o,null,2);

let logRequest = (req,res)=>{
  let text = ['------------------------------',
    `${timeStamp()}`,
    `${req.method} ${req.url}`,
    `HEADERS=> ${toS(req.headers)}`,
    `COOKIES=> ${toS(req.cookies)}`,
    `BODY=> ${toS(req.body)}`,''].join('\n');
  fs.appendFile('request.log',text,()=>{});

  console.log(`${req.method} ${req.url}`);
}

let loadUser = (req,res)=>{
  let sessionid = req.cookies.sessionid;
  let user = registered_users.find(u=>u.sessionid==sessionid);
  if(sessionid && user){
    req.user = user;
  }
};

let respondWithLoginStatus = function (req,res) {
  let loginStatus;
  if(req.user){
    res.respond(getUserInfoAsHtml(req.user),200,{'content-type':'text/html'});
  }else{
    res.respond('false',200,{});
  }
}

let redirectLoggedInUserToHome = (req,res)=>{
  if(req.urlIsOneOf(['/login.html']) && req.user) res.redirect('/home.html');
}


let app = WebApp.create();
app.use(logRequest);
app.use(loadUser);
app.use(redirectLoggedInUserToHome);
app.use(redirectLoggedOutUserToLogin);

app.get('/loginStatus',respondWithLoginStatus);
app.post('/login',(req,res)=>{
  let user = registered_users.find(u=>u.userName==req.body.userName);
  if(!user) {
    res.setHeader('Set-Cookie',`logOn=false`);
    res.redirect('/login.html');
    return;
  }
  let sessionid = new Date().getTime();
  res.setHeader('Set-Cookie',`sessionid=${sessionid}`);
  user.sessionid = sessionid;
  res.redirect('home.html');
});

app.get('/logout',(req,res)=>{
  res.setHeader('Set-Cookie',[`loginFailed=false,Expires=${new Date(1).toUTCString()}`,`sessionid=0,Expires=${new Date(1).toUTCString()}`]);
  delete req.user.sessionid;
  res.redirect('/login.html');
});

app.post('/deleteList',deleteUserList);
app.post('/saveEditedList',saveEditedList);
app.get('/lists',serverUserTodoList);
app.post('/addList',addUserTodoList);
app.post('/items',serveUserListItems);

app.post('/addItem',addItem);
app.post('/deleteItem',deleteItem);

app.postProcess(servFile);
app.postProcess(resourceNotFound);

module.exports=app;
