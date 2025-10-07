import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <h2 id="modal-title" className="text-xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};