import './style.css'

import { Text, Column, PDFDoc, Page, Container } from '.'
import { rgb } from 'pdf-lib';

// async function generatePdf() {
//   console.log('generate pdf')
//   const text1 = new Text('Hello, world!', 20);
//   const text2 = new Text('This is a nested widget example', 16);
//   const text3 = new Text('Using Column widget', 14);

//   const column = new Column([text1, text2, text3], 20);

//   const pdfCreator = new PdfCreator(column);

//   const pdfBytes = await pdfCreator.save();
//   console.log(pdfBytes)
//   return pdfBytes
// };

async function generatePdf() {
  const pdfDoc = new PDFDoc({
    // size: 'US Letter',
    // pageNumber: 'numeric',
    children: [
      Page({
        // margin: 10,
        children: [
           Column({
            // alignItems: 'start',
            children: [
              Text('start',{
                size: 20,
              }),
              Text('hello world', {}),
              Container({
                width: 200,
                height: 100,
                bgColor: '#00ff00',
                children: [
                  Text('hello world', {})
                ]
              }),
              Container({
                width: 100,
                height: 200,
                bgColor: '#2F00FF',
                children: [
                  Text('hello world', {})
                ]
              }),
              Container({
                width: 100,
                height: 50,
                bgColor: '#ff0000',
                // children: [
                  
                // ]
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const bytes = await pdfDoc.save();
  return bytes
}



window.addEventListener("load", async (event) => {
  const bytes = await generatePdf()
  const pdfElement = document.getElementById('pdf')
  pdfElement.src = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
});

