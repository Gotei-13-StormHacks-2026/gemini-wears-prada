import logo from '../assets/gwp_logo.png'

function Homepage() {
  return (
    <>
      <div className="homepage">
        <h1>Welcome to Gemini Wears Prada</h1>
        <button className="fit-check-button">
          Fit Check
        </button>
      </div>

      <style>{styles}</style>
    </>
  )
}

const styles = `
  .homepage {
    background-image: url(${logo});
    background-size: cover;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .homepage h1 {
    font-family: Cursive, sans-serif;
    color: white;
    text-shadow: 2px 2px 4px #000000;
  }

  .fit-check-button {
    background: linear-gradient(to right, #ff7e5f, #feb47b);
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    color: white;
    cursor: pointer;
    font-size: 16px;
  }

  .fit-check-button:hover {
    color: #000;
  }
`;

export default Homepage