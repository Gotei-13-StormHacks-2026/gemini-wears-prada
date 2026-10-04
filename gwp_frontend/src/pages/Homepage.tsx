import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import logo from '../assets/gwp_logo_best.png'
import UploadModal from '../components/UploadModal'

const month = new Date().toLocaleString('en-US', { month: 'long' })

function Homepage() {
  const navigate = useNavigate()
  const [showUpload, setShowUpload] = useState(false)

  const handleFitCheckFile = (file: File) => {
    setShowUpload(false)
    console.log('Fit check file:', file)
  }

  return (
    <>
      <div className="homepage">
        <header className="masthead">
          <div className="issue-line">
            <span>The {month} Issue</span>
            <span>Fashion's Definitive Voice</span>
          </div>
          <h1 className="title">Runway</h1>
        </header>

        <p className="coverline left">
          Florals? For spring?
          <em>Groundbreaking.</em>
        </p>
        <p className="coverline right">
          Cerulean, actually.
          <em>It's not just blue.</em>
        </p>

        <div className="cta">
          <div className="btn-row">
            <button className="fit-check" onClick={() => setShowUpload(true)}>Fit Check</button>
            <button className="wardrobe" onClick={() => navigate('/wardrobe')}>Wardrobe</button>
          </div>
          <p className="dismissal">That's all.</p>
        </div>

        {showUpload && (<UploadModal onClose={() => setShowUpload(false)} onFile={handleFitCheckFile} />)}
      </div>
      <style>{styles}</style>
    </>
  )
}

export default Homepage

const serif = `'Bodoni Moda', Didot, 'Bodoni 72', 'Times New Roman', serif`
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;0,900;1,400&display=swap');

  .homepage {
    --runway-black: #0a0a0a;
    --runway-white: #f9dede;
    --runway-red: #c8102e;
    --cerulean: #1f78b4;

    position: relative;
    background-color: var(--runway-white);
    background-image: url(${logo});
    background-size: 52%;
    background-position: center 62%;
    background-repeat: no-repeat;
    min-height: 100vh;
    overflow: hidden;
    font-family: ${serif};
    color: var(--runway-black);
  }

  .masthead {
    text-align: center;
    padding: 20px 24px 0;
  }

  .issue-line {
    display: flex;
    justify-content: space-between;
    font-size: 18px;
    font-style: italic;
    padding-bottom: 6px;
    border-bottom: 3px double var(--runway-black);
  }

  .homepage .title {
    margin: 0;
    font-family: ${serif};
    font-weight: 900;
    font-size: 100px;
    line-height: 0.95;
    letter-spacing: -0.02em;
    color: var(--runway-black);
    text-shadow: none;
    animation: reveal 4.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }

  .coverline {
    position: absolute;
    top: 42%;
    width: 190px;
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.25;
    opacity: 0;
  }

  .coverline em {
    display: block;
    font-weight: 700;
    font-size: 28px;
  }

  .coverline.left em { color: var(--runway-red); }
  .coverline.right em { color: var(--cerulean); }

  .coverline.left {
    left: 4vw;
    text-align: left;
    animation: slideFromRight 2.6s cubic-bezier(0.22, 0.61, 0.36, 1) 1.5s forwards;
  }
  .coverline.right {
    right: 4vw;
    text-align: right;
    animation: slideFromLeft 2.6s cubic-bezier(0.22, 0.61, 0.36, 1) 1.7s forwards;
  }

  .homepage .cta {
    position: absolute;
    bottom: 7vh;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }

  .btn-row {
    display: flex;
    gap: 100px;
    opacity: 0;
    animation: fadeUp 1.2s ease-out 2.5s forwards;
  }

  .fit-check, .wardrobe {
    background: var(--runway-black);
    padding: 10px 22px;
    border-radius: 10px;
    cursor: pointer;
    font-family: ${serif};
    font-size: 20px;
  }

  .fit-check {
    color: var(--runway-red);
    border: var(--runway-red) 4px solid;
  }

  .wardrobe {
    color: var(--cerulean);
    border: var(--cerulean) 4px solid;
  }

  .fit-check:hover, .wardrobe:hover {
    color: var(--runway-white);
    background: linear-gradient(to right, var(--runway-red), var(--cerulean));
  }

  .main-btn:focus-visible {
    outline: 3px solid var(--cerulean);
    outline-offset: 3px;
  }

  .dismissal {
    margin: 0;
    font-style: italic;
    font-size: 30px;
    font-weight: 900;
    opacity: 0;
    animation: dismiss 1s cubic-bezier(0.34, 1.56, 0.64, 1) 3.0s forwards;
  }

  /* Animation Stuff */
  @keyframes reveal {
    0%   { opacity: 0; letter-spacing: 0.15em; filter: blur(8px); }
    60%  { opacity: 1; filter: blur(0); }
    100% { opacity: 1; letter-spacing: -0.02em; filter: blur(0); }
  }

  @keyframes slideFromRight {
    from { opacity: 0; transform: translateX(calc(92vw - 190px)); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes slideFromLeft {
    from { opacity: 0; transform: translateX(calc(-92vw + 190px)); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes dismiss {
    from { opacity: 0; transform: translateY(-24px) scale(1.15); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

