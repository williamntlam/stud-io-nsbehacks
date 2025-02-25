import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

async function fetchClass(id) {
  try {
    const response = await fetch(`http://localhost:5000/classes/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch class");
    }
    const data = await response.json();
    return { id: data._id, name: data.className };
  } catch (error) {
    console.error("Error fetching class:", error);
    return null;
  }
}

async function fetchUnderstanding(id) {
  return 0;
}

export default function ClassPage() {
  const router = useRouter();

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Update the state when the transcript changes
  React.useEffect(() => {
    setAnswer(transcript);
  }, [transcript]);

  const { id } = useRouter().query;
  const [classData, setClassData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(50);

  const [question, setQuestion] = useState("");
  const [flashcards, setFlashcards] = useState([]);
  const [currentFlashcard, setCurrentFlashcard] = useState(null);
  const [recommendedFlashcard, SetRecommendedFlashcard] = useState(null);
  const [aiText, setAiText] = useState(
    "Add study materials in manage materials to get started."
  );
  const [answer, setAnswer] = useState("");
  const [flip, setFlip] = useState(false);
  const [answerError, setAnswerError] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [studyNotification, setStudyNotification] = useState(false);
  const [topic, setTopic] = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await fetchClass(id);
        setClassData(data);
        const understanding = await fetchUnderstanding(id);
        setProgress(understanding);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  useEffect(() => {
    setFlip(true);
    const timer = setTimeout(() => setFlip(false), 600);
    return () => clearTimeout(timer);
  }, [aiText]);

  if (error) return <div className="text-muted">Error: {error}</div>;
  if (!classData) return <div className="text-muted">Loading...</div>;

  function handleNextQuestion() {
    if (flashcards.length > 0) {
      const nextFlashcard = flashcards.pop();
      setCurrentFlashcard(nextFlashcard);
      setAiText(nextFlashcard.question);
      setFlashcards([...flashcards]);
    } else {
      if (recommendedFlashcard !== null) {
        setAiText(recommendedFlashcard.question);
        SetRecommendedFlashcard(null);
        return;
      }

      setAiText("No more flashcards.");
    }
  }

  async function handleAnswer() {
    if (!answer.trim()) {
      setAnswerError(true);
      resetTranscript();
      return;
    }
    setAnswerError(false);

    const formData = new FormData();
    formData.append("chat_id", "CSC111");
    formData.append("user_id", "67b0e038fede027c6a136c03");
    formData.append("flashcard_id", currentFlashcard.id.flashcard_id);
    formData.append("question", aiText);
    formData.append("answer", answer);

    console.log(`Flashcard id ${currentFlashcard.id.flashcard_id}`);

    try {
      const response = await fetch("http://localhost:5000/answer", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to submit answer");
      }

      setAnswer("");

      const result = await response.json();
      setAiText(
        result.correct ? "Good job!" : `Incorrect! ${result.correct_answer}`
      );
      updateProgress(result.correct);
    } catch (error) {
      console.error("Error submitting answer:", error.message);
    }
  }

  function updateProgress(correct) {
    const step = 3;
    if (correct) {
      setProgress((prev) => Math.min(prev + step, 100));
    } else {
      setProgress((prev) => Math.max(prev - step, 0));
    }
  }

  function handleFileUpload(event) {
    setSelectedFile(event.target.files[0]);
  }

  async function handleUpload() {
    if (!question.trim()) {
      alert("Question field must be filled before uploading.");
      return;
    }

    console.log(question);
    if (selectedFile) {
      const formData = new FormData();
      formData.append("chat_id", "CSC111");
      formData.append("user_id", "67b0e038fede027c6a136c03");
      formData.append("user_request", question);
      formData.append("pdfs", selectedFile); // Key `pdfs` matches your backend expectation

      // Create a loading indicator element
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className =
        "fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50";
      loadingIndicator.innerHTML = `
        <div class="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-white"></div>
      `;
      document.body.appendChild(loadingIndicator);

      try {
        let response;

        if (isReviewMode) {
          response = await fetch("http://localhost:5000/question/review", {
            method: "POST",
            body: formData,
          });
        } else {
          response = await fetch("http://localhost:5000/question/study", {
            method: "POST",
            body: formData,
          });
        }

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        // Remove loading indicator
        document.body.removeChild(loadingIndicator);

        const result = await response.json();
        console.log(result);
        if (!isReviewMode && result.topic !== undefined) {
          setStudyNotification(true);
          setTopic(result.topic);
        }
        console.log("Upload successful:", result);
        setFlashcards(result.flashcards);
        SetRecommendedFlashcard(result.selected_flashcard);
        setUploadedFiles((prevFiles) => [...prevFiles, selectedFile]);
        setSelectedFile(null);
      } catch (error) {
        console.error("Error during upload:", error.message);
      }
    }
  }

  function handleRemoveFile(index) {
    setUploadedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  }

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser does not support speech recognition.</span>;
  }

  return (
    <>
      <style jsx>{`
        .disabled {
          background-color: grey;
          cursor: not-allowed;
        }
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .modal-content {
          padding: 20px;
          border-radius: 8px;
          min-width: 400px;
          min-height: 400px;
          text-align: center;
        }
        .file-input {
          display: none;
        }
        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      `}</style>

      {/* <div className="fixed flex flex-col top-0 right-0 p-4 bg-transparent text-foreground">
        <input
          className="bg-transparent border-b border-foreground focus:outline-none text-foreground"
          type="number"
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          placeholder="Set progress"
        />
        <input
          className="bg-transparent border-b border-foreground focus:outline-none text-foreground"
          type="text"
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Set ai text"
        />
      </div> */}

      <nav className="min-h-screen w-screen flex justify-center items-start pt-10 bg-background">
        <div className="w-full max-w-3xl">
          <div className="flex items-center space-x-4 p-4 rounded justify-between">
            <h1 className="text-5xl font-bold text-foreground">
              {classData.name}
            </h1>
            <div className="flex space-x-4 p-4">
              <button
                className="flex items-center bg-blue-500 hover:bg-blue-700 hover text-foreground px-4 py-2 rounded focus:outline-none"
                onClick={() => router.back()}
              >
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                    />
                  </svg>
                  <p>Back</p>
                </div>
              </button>
              <button
                className="flex items-center bg-blue-500 hover:bg-blue-700 text-foreground px-4 py-2 rounded focus:outline-none"
                onClick={() => setIsModalOpen(true)}
              >
                Manage Materials
              </button>
            </div>
          </div>

          <div className="px-4 mt-4">
            <p className="text-lg font-semibold text-foreground mb-2">
              Understanding
            </p>
            <div
              className="w-full h-4 rounded-full border-2 border-foreground overflow-hidden"
              style={{ backgroundColor: "transparent" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(to right, #4caf50, #8bc34a)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>

          <div className="px-4 mt-6">
            <div
              className={`flex items-center justify-center border border-foreground p-2 rounded bg-background text-foreground mb-4 h-80 ${
                flip ? "flip-animation" : ""
              }`}
              onAnimationEnd={() => setFlip(false)}
            >
              <p>{aiText}</p>
            </div>
            <div
              className={`relative flex justify-center border p-2 rounded w-full mb-2 bg-background ${
                answerError ? "error" : "border-foreground"
              }`}
            >
              <input
                className={`outline-none p-2 rounded w-full mb-2 bg-background text-foreground ${
                  answerError ? "error" : "border-foreground"
                }`}
                placeholder="Your answer"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (e.target.value.trim()) {
                    setAnswerError(false);
                  }
                }}
              />
              <div
                className="absolute right-12 top-1/2 -translate-y-1/2 rounded-full hover:bg-surface transition-transform transition-colors hover:scale-105 cursor-pointer p-2"
                onClick={() => {
                  if (!listening) {
                    resetTranscript(); // Reset the transcript
                    setAnswer(""); // Reset the answer state
                    SpeechRecognition.startListening({ continuous: true });
                  } else {
                    SpeechRecognition.stopListening();
                  }
                }}
              >
                {listening ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                    />
                  </svg>
                )}
              </div>
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full hover:bg-surface transition-transform transition-colors hover:scale-105 cursor-pointer p-2"
                onClick={() => {
                  resetTranscript();
                  setAnswer("");
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </div>
            </div>
            <div className="flex justify-center space-x-4">
              {studyNotification && (
                <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg w-64">
                  <h3 className="text-lg font-bold mb-2">
                    Topics You're Struggling With!
                  </h3>
                  <p>You seem to be struggling with ${topic}</p>
                  <button
                    className="mt-2 bg-white text-blue-500 px-3 py-1 rounded hover:bg-gray-100"
                    onClick={() => {
                      setStudyNotification(false);
                      setTopic(null);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <button
                className="px-6 py-2 w-40 h-12 bg-blue-500 text-foreground rounded hover:bg-blue-700 focus:outline-none text-center"
                onClick={() => {
                  handleNextQuestion();
                  setFlip(true);
                }}
              >
                Next Question
              </button>
              <button
                className={`px-6 py-2 w-40 h-12 bg-surface text-foreground rounded hover:bg-blue-800 hover focus:outline-none text-center ${
                  !answer.trim() ? "disabled" : ""
                }`}
                onClick={() => {
                  handleAnswer();
                  setAnswer("");

                  setFlip(true);
                }}
                disabled={!answer.trim()}
              >
                Answer
              </button>
              {/* <p className="text-foreground font-semibold bg-surface px-2 py-2 rounded-lg shadow-md flex items-center justify-center text-center gap-2">
                {listening ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 1v4m0 0a3 3 0 013 3v4a3 3 0 01-6 0V8a3 3 0 013-3z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 13v3a7 7 0 01-14 0v-3m9 4H9"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
                Microphone {listening ? "Unmuted" : "Muted"}
              </p> */}

              {/* <button
                onClick={() => {
                  resetTranscript(); // Reset the transcript
                  setAnswer(""); // Reset the answer state
                  SpeechRecognition.startListening({ continuous: true });
                }}
                className="ml-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-700 focus:outline-none"
              >
                🎤 Start Recording
              </button>
              <button
                onClick={() => {
                  SpeechRecognition.stopListening();
                }}
                className="ml-2 bg-red-500 text-white p-2 rounded hover:bg-red-700 focus:outline-none"
              >
                ⏹ Stop
              </button>
              <button
                onClick={() => {
                  resetTranscript(); // Reset transcript when stopping the recording
                }}
                className="ml-2 bg-gray-500 text-white hover:bg-gray-700 focus:outline-none p-2 rounded"
              >
                🔄 Reset
              </button> */}
              {/* <button
                onClick={() => setIsReviewMode((prev) => !prev)}
                className="px-6 py-2 w-40 bg-blue-500 text-foreground rounded hover:bg-blue-700 focus:outline-none text-center"
              >
                {isReviewMode
                  ? "Switch to Study Mode"
                  : "Switch to Review Mode"}
              </button> */}
              <div className="flex items-center">
                <button
                  onClick={() => setIsReviewMode((prev) => !prev)}
                  className={`relative w-40 h-12 bg-gray-400 rounded p-1 transition-colors flex items-center justify-between px-1 ${
                    isReviewMode ? "bg-blue-500" : "bg-green-500"
                  }`}
                >
                  <span
                    className={`text-xs font-medium text-white transition-all ${
                      isReviewMode
                        ? "order-last translate-x-4"
                        : "order-first translate-x-16"
                    }`}
                  >
                    {isReviewMode ? "Review Mode" : "Study Mode"}
                  </span>
                  <span
                    className={`absolute w-6 h-10 bg-white rounded shadow-md transition-transform transform ${
                      isReviewMode ? "translate-x-32" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isModalOpen && (
        <div className="modal w-80" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content flex flex-col items-center gap-4 bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              className="border border-foreground p-2 rounded w-full mb-4 bg-background text-foreground"
              placeholder="what would you like to work on"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <h2 className="mb-4 text-2xl">Upload Course Material</h2>
            <label
              className="border rounded p-2 inline-block cursor-pointer min-w-32"
              htmlFor="file-upload"
            >
              {selectedFile ? selectedFile.name : "Choose File"}
            </label>
            <input
              id="file-upload"
              className="file-input"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
            />
            <button
              className="p-2 w-28 bg-primary rounded hover:bg-primary-hover text-foreground"
              onClick={handleUpload}
            >
              Upload
            </button>

            <div className="mt-4">
              <h3>Uploaded Files:</h3>
              <ul>
                {uploadedFiles.map((file, index) => (
                  <li key={index} className="file-item">
                    {file.name}
                    <button
                      className=" text-foreground p-1 rounded"
                      onClick={() => handleRemoveFile(index)}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="p-2 mt-4 bg-primary rounded hover:bg-primary-hover text-foreground"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
