import React from 'react';
export default class ErrorBoundary extends React.Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed)
            return <main className="shell"><section className="notice error" role="alert">
      <h1>화면을 표시하지 못했습니다.</h1>
      <p>계산 결과를 사용하지 말고 초기화한 뒤 다시 확인하세요. 반복되면 입력 조건과 함께 저장소에 알려주세요.</p>
      <button onClick={() => this.setState({ failed: false })}>화면 초기화</button>
      <p><a href="https://github.com/InitusNovus/led-tr-analyzer/issues">문제 보고</a></p>
    </section></main>;
        return this.props.children;
    }
}
