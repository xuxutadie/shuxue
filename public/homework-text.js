/* 教师预览与学生题干共用差异标记，完整数字作为整体，避免只标红数字的一位。 */
function homeworkSegments(original, variant) {
 const tokens = text => String(text).match(/\d+(?:\.\d+)?|[^\d]/gu) || [];
 const a=tokens(original).slice(0,1200), b=tokens(variant);
 const dp=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const same=new Set();let i=0,j=0;
 while(i<a.length&&j<b.length){if(a[i]===b[j]){same.add(j++);i++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
 const segments=[];
 b.forEach((text,index)=>{const changed=!same.has(index),previous=segments.at(-1);if(previous?.changed===changed)previous.text+=text;else segments.push({text,changed});});
 return segments;
}
if(typeof module!=='undefined')module.exports={homeworkSegments};
