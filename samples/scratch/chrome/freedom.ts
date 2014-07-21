declare var freedom:any;

var cpc = freedom['core.uproxypeerconnection']();
cpc.getName().then((name:string) => {
  console.log(name);
});
