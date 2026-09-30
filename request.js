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
      if(!response.ok){const error=new Error(data?.message||`API 오류 (${response.status})`);error.status=response.status;error.code='API';throw error;}
      return {response,data};
    }catch(error){
      if(signal?.aborted)throw new DOMException('취소됨','AbortError');
      if(attempt===retries){
        if(timedOut){const timeoutError=new Error('조회 시간이 초과되었습니다. 다시 시도해 주세요.');timeoutError.code='TIMEOUT';throw timeoutError;}
        if(!error.code)error.code=error instanceof TypeError?'NETWORK':error instanceof SyntaxError?'INVALID_RESPONSE':'UNKNOWN';
        throw error;
      }
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
}

export function requestFailureLabel(error) {
 if(error?.code==='REGION')return '시·도 행정구역 미확인';
 if(error?.code==='TIMEOUT')return '응답 시간 초과';
 if(error?.code==='NETWORK')return '네트워크 연결 또는 브라우저 접근 오류';
 if(error?.code==='INVALID_RESPONSE')return 'API 응답 형식 오류';
 if(error?.status)return `API 응답 오류 (${error.status})`;
 return '대기질 응답 확인 실패';
}
