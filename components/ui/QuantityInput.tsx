import React from 'react';

interface QuantityInputProps {
  id?: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export const QuantityInput: React.FC<QuantityInputProps> = ({ id, value, onValueChange, disabled }) => {

  const handleIncrement = () => onValueChange(value + 1);
  const handleDecrement = () => onValueChange(Math.max(0, value - 1));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10);
    if (!isNaN(numValue)) {
      onValueChange(Math.max(0, numValue));
    } else if (e.target.value === '') {
      onValueChange(0);
    }
  };
  
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={handleDecrement}
        className="w-8 h-8 flex items-center justify-center text-lg font-bold bg-gray-200 text-gray-700 rounded-l-md hover:bg-gray-300 disabled:opacity-50"
        disabled={disabled || value <= 0}
        aria-label="Diminuer la quantité"
      >
        -
      </button>
      <input
        id={id}
        type="number"
        value={value}
        onChange={handleInputChange}
        min="0"
        className="w-16 h-8 p-2 text-center border-t border-b border-gray-300 focus:ring-primary focus:border-primary disabled:bg-gray-100"
        disabled={disabled}
        aria-label="Quantité"
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="w-8 h-8 flex items-center justify-center text-lg font-bold bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300 disabled:opacity-50"
        disabled={disabled}
        aria-label="Augmenter la quantité"
      >
        +
      </button>
    </div>
  );
};