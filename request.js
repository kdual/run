/** Bounded requests, including response-body parsing; cancellation never retries. */
export async function requestJson(url, signal, {timeoutMs=12000,retries=1}={}) {
  for(let attempt=0;attempt<=retries;attempt++){
    if(signal?.aborted)throw new DOMException('취소됨','AbortError');
    const controller=new AbortController();let timedOut=false;
    const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{
      const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data?.message||`API 오류 (${response.status})`);
      return {response,data};
    }catch(error){
      if(signal?.aborted)throw new DOMException('취소됨','AbortError');
      if(attempt===retries)throw timedOut?new Error('조회 시간이 초과되었습니다. 다시 시도해 주세요.'):error;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
}
