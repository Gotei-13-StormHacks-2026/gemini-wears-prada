import logo from '../assets/gwp_logo_best.png'

function getMonth() {
  
}

function Homepage() {
  return (
    <>
      <div className="homepage">
        <header className="masthead">
          <div className="issue-line">
            <span>The September Issue</span>
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
          <button className="main-btn">Fit Check</button>
          <p className="dismissal">That's all.</p>
        </div>
      </div>
      <style>{styles}</style>
    </>
  )
}

const serif = `'Bodoni Moda', Didot, 'Bodoni 72', 'Times New Roman', serif`

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;0,900;1,400&display=swap');

  .homepage {
    --runway-black: #0a0a0a;
    --runway-white: #fafafa;
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
    animation: reveal 1.5s ease-out both;
  }

  .coverline {
    position: absolute;
    top: 42%;
    width: 190px;
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.25;
  }

  .coverline em {
    display: block;
    font-weight: 700;
    font-size: 28px;
  }

  .coverline.left em { color: var(--runway-red); }
  .coverline.right em { color: var(--cerulean); }
  .coverline.left { left: 4vw; text-align: left; }
  .coverline.right { right: 4vw; text-align: right; }

  .homepage .cta {
    position: absolute;
    bottom: 7vh;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .main-btn {
    background: linear-gradient(to right, var(--runway-red), var(--cerulean));
    border: var(--runway-black) 5px solid;
    padding: 10px;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    font-size: 20px;
    position: absolute;
    bottom: 10vh;
  }

  .main-btn:hover {
    background: linear-gradient(to left, var(--runway-red), var(--cerulean));
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
  }

  @keyframes reveal {
    from { opacity: 0; letter-spacing: 0.08em; }
    to   { opacity: 1; letter-spacing: -0.02em; }
  }

`;

export default Homepage