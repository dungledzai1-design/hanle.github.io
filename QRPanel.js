import React, { useState, useEffect, useRef } from 'react';

export default function QRPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [loginTime, setLoginTime] = useState('');
  const [currentTab, setCurrentTab] = useState('login');
  const [state, setState] = useState('idle');
  const [qrImage, setQrImage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [imei, setImei] = useState('—');
  const [pythonCookie, setPythonCookie] = useState('—');
  const [jsCookie, setJsCookie] = useState('—');
  const [resultTab, setResultTab] = useState('python');
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastScan, setLastScan] = useState('Chưa có');
  const pollTimerRef = useRef(null);

  // Check session on mount
  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('zqp_session') || 'null');
    if (session) {
      setIsLoggedIn(true);
      setUsername(session.username);
      setLoginTime(new Date(session.loginTime).toLocaleString('vi-VN'));
    }
  }, []);

  // Toast function
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  };

  // Auth functions
  const handleLogin = () => {
    const user = document.getElementById('login-user')?.value.trim();
    const pass = document.getElementById('login-pass')?.value;

    if (!user || !pass) {
      showToast('Vui lòng nhập đầy đủ thông tin.', 'error');
      return;
    }

    const users = JSON.parse(localStorage.getItem('zqp_users') || '{}');
    if (!users[user] || users[user].hash !== btoa(user + ':' + pass)) {
      showToast('Tên đăng nhập hoặc mật khẩu không đúng.', 'error');
      return;
    }

    const session = { username: user, loginTime: Date.now() };
    localStorage.setItem('zqp_session', JSON.stringify(session));
    setIsLoggedIn(true);
    setUsername(user);
    setLoginTime(new Date(session.loginTime).toLocaleString('vi-VN'));
    showToast(`Chào mừng, ${user}!`, 'success');
  };

  const handleRegister = () => {
    const user = document.getElementById('reg-user')?.value.trim();
    const pass = document.getElementById('reg-pass')?.value;
    const pass2 = document.getElementById('reg-pass2')?.value;

    if (user.length < 4) {
      showToast('Tên đăng nhập tối thiểu 4 ký tự.', 'error');
      return;
    }
    if (pass.length < 6) {
      showToast('Mật khẩu tối thiểu 6 ký tự.', 'error');
      return;
    }
    if (pass !== pass2) {
      showToast('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }

    const users = JSON.parse(localStorage.getItem('zqp_users') || '{}');
    if (users[user]) {
      showToast('Tên đăng nhập đã tồn tại.', 'error');
      return;
    }

    users[user] = { hash: btoa(user + ':' + pass), created: Date.now() };
    localStorage.setItem('zqp_users', JSON.stringify(users));
    showToast('Tạo tài khoản thành công!', 'success');
    setCurrentTab('login');
  };

  const handleLogout = () => {
    localStorage.removeItem('zqp_session');
    setIsLoggedIn(false);
    setUsername('');
    setState('idle');
    setQrImage(null);
    setIsScanning(false);
    setImei('—');
    setPythonCookie('—');
    setJsCookie('—');
    setDrawerOpen(false);
    showToast('Đã đăng xuất.', 'info');
  };

  // QR Flow functions
  const buildPythonCookie = (imei, cookies) => {
    const lines = [`# IMEI: ${imei}`, `# Generated: ${new Date().toISOString()}`, '', 'cookies = {'];
    if (typeof cookies === 'object' && !Array.isArray(cookies)) {
      Object.entries(cookies).forEach(([k, v]) => {
        lines.push(`    "${k}": "${v}",`);
      });
    }
    lines.push('}');
    lines.push('');
    lines.push(`imei = "${imei}"`);
    return lines.join('\n');
  };

  const buildJSCookie = (imei, cookies) => {
    const parsedCookies = [];
    const process = (name, value) => {
      if (name === 'zpw_sek') {
        parsedCookies.push({
          domain: '.chat.zalo.me',
          expirationDate: Math.floor(Date.now() / 1000) + 86400 * 30,
          hostOnly: false,
          httpOnly: true,
          name,
          path: '/',
          sameSite: 'no_restriction',
          secure: true,
          session: false,
          storeId: '0',
          value
        });
      } else {
        parsedCookies.push({ name, value });
      }
    };

    if (typeof cookies === 'object' && !Array.isArray(cookies)) {
      Object.entries(cookies).forEach(([k, v]) => process(k, v));
    } else if (Array.isArray(cookies)) {
      cookies.forEach(c => process(c.name, c.value));
    }

    const obj = {
      url: 'https://chat.zalo.me',
      imei,
      cookies: parsedCookies
    };
    return JSON.stringify(obj, null, 2);
  };

  const startFlow = async () => {
    if (state !== 'idle' && state !== 'done' && state !== 'error') return;

    setState('generating');
    setIsLoading(true);
    setQrImage(null);
    setImei('—');
    setPythonCookie('—');
    setJsCookie('—');

    try {
      const response = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Không thể tạo QR');
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setQrImage(data.qr_image);
      setIsScanning(true);
      setState('waiting_scan');
      showToast('QR đã tạo — mở Zalo và quét mã.', 'info');

      // Start polling
      pollStatus(data.session_token);
    } catch (error) {
      setState('error');
      setIsLoading(false);
      showToast(error.message || 'Lỗi không xác định.', 'error');
    }
  };

  const pollStatus = async (token) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60;

    const poll = async () => {
      if (attempts++ > MAX_ATTEMPTS) {
        setIsScanning(false);
        setIsLoading(false);
        setState('error');
        showToast('Hết thời gian — vui lòng thử lại.', 'error');
        return;
      }

      try {
        const response = await fetch(`/api/qr/status?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          setTimeout(poll, 2000);
          return;
        }

        const data = await response.json();

        if (data.status === 'scanned') {
          setState('waiting_confirm');
          showToast('Đã quét! Vui lòng xác nhận trên điện thoại.', 'info');
          setTimeout(poll, 1500);
        } else if (data.status === 'confirmed' || data.status === 'success') {
          setIsScanning(false);
          setIsLoading(false);
          setState('done');

          const imei = data.imei || data.data?.imei || '';
          const cookies = data.cookies || data.data?.cookies || {};

          setImei(imei || '—');
          setPythonCookie(buildPythonCookie(imei, cookies));
          setJsCookie(buildJSCookie(imei, cookies));
          setLastScan(new Date().toLocaleString('vi-VN'));

          showToast('Lấy dữ liệu thành công!', 'success');
        } else if (data.status === 'rejected') {
          setIsScanning(false);
          setIsLoading(false);
          setState('error');
          showToast('Đăng nhập bị từ chối trên điện thoại.', 'error');
        } else {
          setTimeout(poll, 1500);
        }
      } catch (error) {
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  const copyResult = (type) => {
    const text = type === 'python' ? pythonCookie : jsCookie;
    if (!text || text === '—') {
      showToast('Chưa có dữ liệu để sao chép.', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast('Đã sao chép vào clipboard!', 'success');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showToast('Đã sao chép!', 'success');
    });
  };

  const downloadResult = (type) => {
    const text = type === 'python' ? pythonCookie : jsCookie;
    if (!text || text === '—') {
      showToast('Chưa có dữ liệu để tải.', 'error');
      return;
    }
    const fname = type === 'python'
      ? `zalo_cookie_python_${Date.now()}.txt`
      : `zalo_cookie_js_${Date.now()}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Đã tải ${fname}`, 'success');
  };

  // Auth UI
  if (!isLoggedIn) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <span className="brace brace-l">{'{'}</span>
              <span className="brace brace-r">{'}'}</span>
            </div>
            <h1>Zalo QR Panel</h1>
            <p>Đăng nhập để tiếp tục</p>
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab ${currentTab === 'login' ? 'active' : ''}`}
              onClick={() => setCurrentTab('login')}
            >
              Đăng nhập
            </button>
            <button
              className={`auth-tab ${currentTab === 'register' ? 'active' : ''}`}
              onClick={() => setCurrentTab('register')}
            >
              Đăng ký
            </button>
          </div>

          {currentTab === 'login' ? (
            <div>
              <div className="form-group">
                <label className="form-label">Tên đăng nhập</label>
                <input
                  className="form-input"
                  type="text"
                  id="login-user"
                  placeholder="username"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu</label>
                <input
                  className="form-input"
                  type="password"
                  id="login-pass"
                  placeholder="••••••••"
                />
              </div>
              <button className="btn-primary" onClick={handleLogin}>
                Đăng nhập
              </button>
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label className="form-label">Tên đăng nhập</label>
                <input
                  className="form-input"
                  type="text"
                  id="reg-user"
                  placeholder="Tối thiểu 4 ký tự"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu</label>
                <input
                  className="form-input"
                  type="password"
                  id="reg-pass"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu</label>
                <input
                  className="form-input"
                  type="password"
                  id="reg-pass2"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
              <button className="btn-primary" onClick={handleRegister}>
                Tạo tài khoản
              </button>
            </div>
          )}
          <p className="auth-note">Dữ liệu lưu cục bộ trong trình duyệt. Không gửi lên server.</p>
        </div>

        <style jsx>{`
          .auth-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #050810;
          }
          .auth-card {
            width: 100%;
            max-width: 400px;
            background: rgba(8,13,26,0.75);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 20px;
            padding: 32px 28px;
            backdrop-filter: blur(24px);
          }
          .auth-logo { text-align: center; margin-bottom: 28px; }
          .auth-logo-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            margin: 0 auto 12px;
            background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(16,185,129,0.2));
            border: 1px solid rgba(37,99,235,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .brace {
            position: absolute;
            font-weight: 700;
            font-size: 18px;
            line-height: 1;
          }
          .brace-l { left: 4px; background: linear-gradient(180deg,#3b82f6,#34d399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
          .brace-r { right: 4px; background: linear-gradient(180deg,#34d399,#3b82f6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
          .auth-logo h1 { font-size: 20px; font-weight: 700; color: #e2e8f0; }
          .auth-logo p { font-size: 12px; color: rgba(226,232,240,0.25); margin-top: 4px; }
          .auth-tabs {
            display: flex;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            padding: 3px;
            margin-bottom: 24px;
          }
          .auth-tab {
            flex: 1;
            padding: 8px;
            border-radius: 8px;
            border: none;
            background: transparent;
            color: rgba(226,232,240,0.45);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all .2s;
          }
          .auth-tab.active {
            background: linear-gradient(135deg, rgba(37,99,235,0.4), rgba(16,185,129,0.3));
            color: #e2e8f0;
            box-shadow: 0 0 12px rgba(37,99,235,0.2);
          }
          .form-group { margin-bottom: 16px; }
          .form-label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: rgba(226,232,240,0.45);
            text-transform: uppercase;
            letter-spacing: .08em;
            margin-bottom: 7px;
          }
          .form-input {
            width: 100%;
            padding: 10px 14px;
            border-radius: 10px;
            background: rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.07);
            color: #e2e8f0;
            font-size: 14px;
            outline: none;
            transition: border-color .2s, box-shadow .2s;
          }
          .form-input:focus {
            border-color: rgba(37,99,235,0.5);
            box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
          }
          .form-input::placeholder { color: rgba(226,232,240,0.25); }
          .btn-primary {
            width: 100%;
            padding: 11px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            background: linear-gradient(135deg, #2563eb, #10b981);
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            transition: opacity .2s, transform .15s;
            box-shadow: 0 4px 24px rgba(37,99,235,0.25);
          }
          .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
          .auth-note {
            font-size: 11px;
            color: rgba(226,232,240,0.25);
            text-align: center;
            margin-top: 14px;
            line-height: 1.6;
          }
        `}</style>
      </div>
    );
  }

  // Dashboard UI
  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-brand">
          <span>Zalo QR Panel</span>
        </div>
        <button className="nav-hamburger" onClick={() => setDrawerOpen(true)}>
          <span></span><span></span><span></span>
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dash-header">
          <div>
            <div className="dash-title">Zalo QR Extractor</div>
            <div className="dash-subtitle">Quét QR để lấy IMEI & Cookie</div>
          </div>
        </div>

        <div className="status-row">
          <div className={`status-chip s-waiting ${state === 'idle' || state === 'generating' ? 'active-state' : ''}`}>
            <span className="status-dot"></span> Chờ bắt đầu
          </div>
          <div className={`status-chip s-scanning ${state === 'waiting_scan' ? 'active-state' : ''}`}>
            <span className="status-dot"></span> Chờ quét QR
          </div>
          <div className={`status-chip s-confirm ${state === 'waiting_confirm' ? 'active-state' : ''}`}>
            <span className="status-dot"></span> Chờ xác nhận
          </div>
          <div className={`status-chip s-done ${state === 'done' ? 'active-state' : ''}`}>
            <span className="status-dot"></span> Hoàn thành
          </div>
        </div>

        <div className="panel">
          <div className="qr-zone">
            <div className={`qr-box ${qrImage ? 'has-qr' : ''} ${isScanning ? 'scanning' : ''}`}>
              <div className="scan-line"></div>
              {qrImage ? (
                <img src={`data:image/png;base64,${qrImage}`} alt="QR Code" />
              ) : (
                <div className="qr-placeholder">
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
                    {isLoading ? 'Đang tạo QR...' : 'Nhấn Start để tạo QR'}
                  </span>
                </div>
              )}
            </div>

            <button
              className="btn-start"
              onClick={startFlow}
              disabled={isLoading || state === 'waiting_scan' || state === 'waiting_confirm'}
            >
              {isLoading ? <span className="spinner"></span> : null}
              {isLoading ? 'Đang khởi tạo...' : 'Start'}
            </button>
          </div>

          <div className={`result-section ${state === 'done' ? 'visible' : ''}`}>
            <div className="imei-row">
              <span className="imei-label">IMEI</span>
              <span className="imei-value">{imei}</span>
            </div>

            <div style={{ marginTop: '18px' }}>
              <div className="result-tabs">
                <button
                  className={`result-tab ${resultTab === 'python' ? 'active' : ''}`}
                  onClick={() => setResultTab('python')}
                >
                  Cookie Python
                </button>
                <button
                  className={`result-tab ${resultTab === 'js' ? 'active' : ''}`}
                  onClick={() => setResultTab('js')}
                >
                  Cookie JS
                </button>
              </div>

              <div className="result-pane active">
                <div className="result-box">
                  {resultTab === 'python' ? pythonCookie : jsCookie}
                </div>
                <div className="result-actions">
                  <button
                    className="btn-action btn-copy"
                    onClick={() => copyResult(resultTab)}
                  >
                    Sao chép
                  </button>
                  <button
                    className="btn-action"
                    onClick={() => downloadResult(resultTab)}
                  >
                    Tải .txt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)}></div>
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
        <div className="drawer-title">Admin Info</div>

        <div className="drawer-section">
          <div className="drawer-section-title">Tài khoản</div>
          <div className="drawer-info-row">
            <span className="drawer-info-label">Username</span>
            <span className="drawer-info-value">{username}</span>
          </div>
          <div className="drawer-info-row">
            <span className="drawer-info-label">Trạng thái</span>
            <span className="badge badge-green">Đã đăng nhập</span>
          </div>
          <div className="drawer-info-row">
            <span className="drawer-info-label">Đăng nhập lúc</span>
            <span className="drawer-info-value">{loginTime}</span>
          </div>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">Phiên làm việc</div>
          <div className="drawer-info-row">
            <span className="drawer-info-label">Lần quét gần nhất</span>
            <span className="drawer-info-value">{lastScan}</span>
          </div>
          <div className="drawer-info-row">
            <span className="drawer-info-label">IMEI hiện tại</span>
            <span className="drawer-info-value" style={{ fontFamily: 'monospace', fontSize: '10px' }}>{imei}</span>
          </div>
        </div>

        <button className="btn-logout" onClick={handleLogout}>Đăng xuất</button>
      </div>

      <div id="toast-container" className="toast-container"></div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: #050810;
          color: #e2e8f0;
        }
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: rgba(5,8,16,0.6);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-brand {
          font-weight: 700;
          font-size: 15px;
          background: linear-gradient(135deg, #3b82f6, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .nav-hamburger {
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: background .2s;
        }
        .nav-hamburger:hover { background: rgba(255,255,255,.07); }
        .nav-hamburger span {
          width: 16px;
          height: 1.5px;
          background: rgba(226,232,240,0.45);
          border-radius: 2px;
          display: block;
        }
        .dashboard-content {
          padding: 24px;
          max-width: 760px;
          margin: 0 auto;
        }
        .dash-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .dash-title { font-size: 18px; font-weight: 700; }
        .dash-subtitle { font-size: 12px; color: rgba(226,232,240,0.45); margin-top: 2px; }
        .status-row {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .status-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 20px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          font-size: 12px;
          font-weight: 500;
          transition: all .3s;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(226,232,240,0.25);
          transition: background .3s;
        }
        .status-chip.s-waiting .status-dot { background: #64748b; }
        .status-chip.s-scanning .status-dot { background: #f59e0b; animation: pulse-dot .8s ease-in-out infinite; }
        .status-chip.s-confirm .status-dot { background: #3b82f6; animation: pulse-dot .8s ease-in-out infinite; }
        .status-chip.s-done .status-dot { background: #34d399; }
        .status-chip.active-state { border-color: rgba(37,99,235,0.4); background: rgba(37,99,235,0.08); }
        @keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:.3;} }

        .panel {
          background: rgba(8,13,26,0.7);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 28px;
          backdrop-filter: blur(20px);
        }
        .qr-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }
        .qr-box {
          width: 220px;
          height: 220px;
          border-radius: 16px;
          background: rgba(0,0,0,0.4);
          border: 2px dashed rgba(255,255,255,0.07);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: rgba(226,232,240,0.25);
          font-size: 13px;
          position: relative;
          transition: border-color .3s;
        }
        .qr-box.has-qr {
          border-style: solid;
          border-color: rgba(37,99,235,0.4);
          background: #fff;
          padding: 8px;
        }
        .qr-box img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 8px;
        }
        .qr-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .scan-line {
          position: absolute;
          left: 8px;
          right: 8px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, #34d399, transparent);
          border-radius: 2px;
          display: none;
          animation: scan-sweep 2s ease-in-out infinite;
        }
        .qr-box.scanning .scan-line { display: block; }
        @keyframes scan-sweep {
          0%  { top: 8px; opacity: .8; }
          50% { top: calc(100% - 10px); opacity: 1; }
          100%{ top: 8px; opacity: .8; }
        }
        .btn-start {
          padding: 12px 32px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #2563eb, #10b981);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 24px rgba(37,99,235,0.3);
          transition: opacity .2s, transform .15s;
        }
        .btn-start:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
        .btn-start:disabled { opacity: .4; cursor: not-allowed; transform: none; }
        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to{ transform:rotate(360deg); } }

        .result-section { display: none; }
        .result-section.visible { display: block; }
        .imei-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .imei-label {
          font-size: 11px;
          color: rgba(226,232,240,0.45);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .06em;
          white-space: nowrap;
        }
        .imei-value {
          font-family: monospace;
          font-size: 12px;
          color: #06b6d4;
          flex: 1;
          word-break: break-all;
        }
        .result-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 14px;
        }
        .result-tab {
          padding: 7px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.07);
          background: transparent;
          color: rgba(226,232,240,0.45);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
        }
        .result-tab.active {
          background: linear-gradient(135deg, rgba(37,99,235,0.3), rgba(16,185,129,0.2));
          border-color: rgba(37,99,235,0.4);
          color: #e2e8f0;
        }
        .result-pane.active { display: block; }
        .result-box {
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 14px;
          font-family: monospace;
          font-size: 11px;
          color: #34d399;
          line-height: 1.7;
          max-height: 200px;
          overflow-y: auto;
          word-break: break-all;
        }
        .result-box::-webkit-scrollbar { width: 4px; }
        .result-box::-webkit-scrollbar-thumb { background: rgba(37,99,235,0.3); border-radius: 2px; }
        .result-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .btn-action {
          flex: 1;
          padding: 9px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.035);
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-action:hover { background: rgba(255,255,255,.07); border-color: rgba(37,99,235,0.4); }

        /* Drawer */
        .drawer-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
        }
        .drawer-overlay.open { display: block; }
        .drawer {
          position: fixed;
          top: 0;
          right: -320px;
          width: 300px;
          height: 100%;
          background: rgba(8,13,26,0.95);
          border-left: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(24px);
          z-index: 201;
          padding: 24px 20px;
          transition: right .3s ease;
          overflow-y: auto;
        }
        .drawer.open { right: 0; }
        .drawer-close {
          background: none;
          border: none;
          color: rgba(226,232,240,0.45);
          cursor: pointer;
          font-size: 20px;
          float: right;
          margin-bottom: 16px;
        }
        .drawer-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 20px;
          clear: both;
          background: linear-gradient(135deg, #3b82f6, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .drawer-section { margin-bottom: 20px; }
        .drawer-section-title {
          font-size: 10px;
          font-weight: 600;
          color: rgba(226,232,240,0.25);
          text-transform: uppercase;
          letter-spacing: .1em;
          margin-bottom: 10px;
        }
        .drawer-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .drawer-info-label { font-size: 12px; color: rgba(226,232,240,0.45); }
        .drawer-info-value { font-size: 12px; color: #e2e8f0; font-weight: 500; text-align: right; max-width: 160px; word-break: break-all; }
        .badge {
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
        }
        .badge-green { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.25); }
        .btn-logout {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(239,68,68,0.3);
          background: rgba(239,68,68,0.08);
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
          margin-top: 8px;
        }
        .btn-logout:hover { background: rgba(239,68,68,0.15); }

        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 999;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .toast {
          padding: 12px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          backdrop-filter: blur(16px);
          border: 1px solid;
          animation: toast-in .3s ease;
        }
        .toast-success { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #34d399; }
        .toast-error { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: #f87171; }
        .toast-info { background: rgba(37,99,235,0.15); border-color: rgba(37,99,235,0.3); color: #3b82f6; }
        @keyframes toast-in { from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
