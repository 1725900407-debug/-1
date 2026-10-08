import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="fatal"><h1>页面遇到一个问题</h1><p>已保存的学习记录仍留在当前浏览器。刷新后可以重新打开。</p><button onClick={()=>location.reload()}>重新打开</button></div>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
